import { buildModule } from "@nomicfoundation/hardhat-ignition/modules";
import RoleManagerModule from "./RoleManager";

export default buildModule("AcknowledgmentLogModule", (m) => {
  const { roleManager } = m.useModule(RoleManagerModule);
  const acknowledgmentLog = m.contract("AcknowledgmentLog", [roleManager]);
  return { acknowledgmentLog };
});
