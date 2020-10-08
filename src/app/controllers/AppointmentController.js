import { startOfHour, parseISO, isBefore } from "date-fns";

import Appointment from "../models/Appointment";
import User from "../models/User";
import * as Yup from "yup";

class AppointmentController {
  async store(req, res) {
    const schema = Yup.object().shape({
      provider_id: Yup.number().required(),
      date: Yup.date().required(),
    });

    if (!(await schema.isValid(req.body))) {
      return res.status(400).json({ error: "Validation fails." });
    }

    const { provider_id, date } = req.body;

    // Check if provider selected by user is a provider
    const isProvider = await User.findOne({
      where: { id: provider_id, provider: true },
    });

    if (!isProvider) {
      return res
        .status(401)
        .json({ error: "Appointments can only be assigned to providers." });
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

    return res.json(appointment);
  }
}

export default new AppointmentController();
