// SPDX-License-Identifier: MIT
pragma solidity ^0.8.24;

import "@openzeppelin/contracts/access/AccessControl.sol";

contract RoleManager is AccessControl {
    bytes32 public constant PROFESSOR_ROLE = keccak256("PROFESSOR_ROLE");
    bytes32 public constant STUDENT_ROLE   = keccak256("STUDENT_ROLE");

    mapping(address => string) private _groups;

    constructor(address admin) {
        _grantRole(DEFAULT_ADMIN_ROLE, admin);
    }

    function assignRole(address account, bytes32 role) external onlyRole(DEFAULT_ADMIN_ROLE) {
        _grantRole(role, account);
    }

    function revokeUserRole(address account, bytes32 role) external onlyRole(DEFAULT_ADMIN_ROLE) {
        _revokeRole(role, account);
    }

    function assignGroup(address account, string calldata group) external onlyRole(DEFAULT_ADMIN_ROLE) {
        _groups[account] = group;
    }

    function getGroup(address account) external view returns (string memory) {
        return _groups[account];
    }

    function getRoleOf(address account) external view returns (string memory) {
        if (hasRole(DEFAULT_ADMIN_ROLE, account)) return "ADMIN";
        if (hasRole(PROFESSOR_ROLE, account))     return "PROFESSOR";
        if (hasRole(STUDENT_ROLE, account))       return "STUDENT";
        return "NONE";
    }
}
