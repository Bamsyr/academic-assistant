import { buildModule } from "@nomicfoundation/hardhat-ignition/modules";
import RoleManagerModule from "./RoleManager";
import AnnouncementLogModule from "./AnnouncementLog";
import DocumentRegistryModule from "./DocumentRegistry";
import AcknowledgmentLogModule from "./AcknowledgmentLog";

export default buildModule("AcademicSystemModule", (m) => {
  const { roleManager }      = m.useModule(RoleManagerModule);
  const { announcementLog }  = m.useModule(AnnouncementLogModule);
  const { documentRegistry } = m.useModule(DocumentRegistryModule);
  const { acknowledgmentLog} = m.useModule(AcknowledgmentLogModule);

  return { roleManager, announcementLog, documentRegistry, acknowledgmentLog };
});
