import { buildModule } from "@nomicfoundation/hardhat-ignition/modules";
import RoleManagerModule from "./RoleManager";

export default buildModule("DocumentRegistryModule", (m) => {
  const { roleManager } = m.useModule(RoleManagerModule);
  const documentRegistry = m.contract("DocumentRegistry", [roleManager]);
  return { documentRegistry };
});
