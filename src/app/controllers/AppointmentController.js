import { startOfHour, parseISO, isBefore, format, subHours } from "date-fns";
import * as Yup from "yup";
import pt from "date-fns/locale/pt";

import Appointment from "../models/Appointment";
import User from "../models/User";
import File from "../models/File";
import Notification from "../schemas/Notification";

import CancellationMail from "../jobs/CancellationMail";
import Queue from "../../lib/Queue";

class AppointmentController {
  async index(req, res) {
    const { page = 1 } = req.query;

    const appointments = await Appointment.findAll({
      where: { user_id: req.userId, canceled_at: null, },
      order: ["date"],
      attributes: ["id", "date", "past", "cancelable"],
      limit: 20,
      offset: (page - 1) * 20,
      include: [
        {
          model: User,
          as: "provider",
          attributes: ["id", "name"],
          include: [
            {
              model: File,
              as: "avatar",
              attributes: ["path", "url"],
            },
          ],
        },
      ],
    });
    return res.json(appointments);
  }

  async store(req, res) {
    const schema = Yup.object().shape({
      provider_id: Yup.number().required(),
      date: Yup.date().required(),
    });

    if (!(await schema.isValid(req.body))) {
      return res.status(400).json({ error: "Validation fails." });
    }

    const { provider_id, date } = req.body;

    // Check if provider selected by user is actully a provider and ensure no
    // schedules are registered to self
    const isProvider = await User.findOne({
      where: { id: provider_id, provider: true },
    });

    if (!isProvider) {
      return res
        .status(401)
        .json({ error: "Appointments can only be assigned to providers." });
    }

    if (provider_id === req.userId) {
      return res
        .status(401)
        .json({ error: "You can't make appointments in your own schedule." });
    }

    // Ensure no past dates are scheduled
    const hourStart = startOfHour(parseISO(date));

    if (isBefore(hourStart, new Date())) {
      return res
        .status(401)
        .json({ error: "Appointments need to be scheduled in future date." });
    }

    // Check provider schedule availability
    const checkAvailability = await Appointment.findOne({
      where: {
        provider_id,
        canceled_at: null,
        date: hourStart,
      },
    });

    if (checkAvailability) {
      return res.status(400).json({
        error: "Appointment schedule is not available.",
      });
    }

    const appointment = await Appointment.create({
      user_id: req.userId,
      provider_id,
      date: hourStart,
    });

    // Notify appointment to provider
    const user = await User.findByPk(req.userId);
    const formattedDate = format(
      hourStart,
      "'dia' dd 'de' MMMM', às' H:mm'h'",
      { locale: pt }
    );

    await Notification.create({
      content: `Novo agendamento de ${user.name} para ${formattedDate}`,
      user: provider_id,
    });

    return res.json(appointment);
  }

  async delete(req, res) {
    const appointment = await Appointment.findByPk(req.params.id, {
      include: [
        {
          model: User,
          as: "provider",
          attributes: ["name", "email"],
        },
        {
          model: User,
          as: "user",
          attributes: ["name"],
        },
      ],
    });

    if (appointment.user_id !== req.userId) {
      return res
        .status(401)
        .json({ error: "You can only cancel your own appointments." });
    }

    const cancelLimit = subHours(appointment.date, 2);
    if (isBefore(cancelLimit, new Date())) {
      return res.status(401).json({
        error: "You can only cancel appoitments up to 2 hours before it.",
      });
    }

    appointment.canceled_at = new Date();

    await appointment.save();

    // Mail send via queue
    await Queue.add(CancellationMail.key, {
      appointment,
    });

    return res.json(appointment);
  }
}

export default new AppointmentController();
