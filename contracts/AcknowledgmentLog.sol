// SPDX-License-Identifier: MIT
pragma solidity ^0.8.24;

import "@openzeppelin/contracts/access/IAccessControl.sol";

contract AcknowledgmentLog {
    bytes32 public constant STUDENT_ROLE = keccak256("STUDENT_ROLE");

    IAccessControl public immutable roleManager;

    // announcementId => student => acknowledged
    mapping(uint256 => mapping(address => bool)) private _acknowledged;
    // announcementId => list of students who acknowledged
    mapping(uint256 => address[]) private _acknowledgers;

    event Acknowledged(
        uint256 indexed announcementId,
        address indexed student,
        uint256         timestamp
    );

    modifier onlyStudent() {
        require(roleManager.hasRole(STUDENT_ROLE, msg.sender), "Not a student");
        _;
    }

    constructor(address _roleManager) {
        roleManager = IAccessControl(_roleManager);
    }

    function acknowledge(uint256 announcementId) external onlyStudent {
        require(!_acknowledged[announcementId][msg.sender], "Already acknowledged");
        _acknowledged[announcementId][msg.sender] = true;
        _acknowledgers[announcementId].push(msg.sender);
        emit Acknowledged(announcementId, msg.sender, block.timestamp);
    }

    function hasAcknowledged(uint256 announcementId, address student) external view returns (bool) {
        return _acknowledged[announcementId][student];
    }

    function getAcknowledgments(uint256 announcementId) external view returns (address[] memory) {
        return _acknowledgers[announcementId];
    }

    function getAcknowledgmentCount(uint256 announcementId) external view returns (uint256) {
        return _acknowledgers[announcementId].length;
    }
}
