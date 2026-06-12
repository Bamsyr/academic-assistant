import { buildModule } from "@nomicfoundation/hardhat-ignition/modules";

export default buildModule("RoleManagerModule", (m) => {
  // account(0) is the deployer — becomes DEFAULT_ADMIN_ROLE
  const admin = m.getAccount(0);
  const roleManager = m.contract("RoleManager", [admin]);
  return { roleManager };
});
