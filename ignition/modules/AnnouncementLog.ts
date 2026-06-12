import { buildModule } from "@nomicfoundation/hardhat-ignition/modules";
import RoleManagerModule from "./RoleManager";

export default buildModule("AnnouncementLogModule", (m) => {
  const { roleManager } = m.useModule(RoleManagerModule);
  const announcementLog = m.contract("AnnouncementLog", [roleManager]);
  return { announcementLog };
});
