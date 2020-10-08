import Sequelize, { Model } from "sequelize";

class Appointment extends Model {
  static init(sequelize) {
    super.init(
      {
        date: Sequelize.DATE,
        canceled_ate: Sequelize.DATE,
      },
      {
        sequelize,
      }
    );

    return this;
  }

  // alias is mandatory if more than one relashionship
  static associate(models) {
    this.belongsTo(models.User, { foreignKey: "user_id", as: "user" });
    this.belongsTo(models.User, { foreignKey: "provider_id", as: "provider" });
  }
}

export default Appointment;