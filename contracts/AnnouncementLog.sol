// SPDX-License-Identifier: MIT
pragma solidity ^0.8.24;

import "@openzeppelin/contracts/access/IAccessControl.sol";

contract AnnouncementLog {
    bytes32 public constant PROFESSOR_ROLE = keccak256("PROFESSOR_ROLE");

    struct Announcement {
        uint256 id;
        address publisher;
        bytes32 contentHash;
        string  category;
        string  targetGroup;
        string  content;
        uint256 timestamp;
    }

    IAccessControl public immutable roleManager;
    uint256 private _counter;
    mapping(uint256 => Announcement) public announcements;

    event AnnouncementPublished(
        uint256 indexed id,
        address indexed publisher,
        bytes32         contentHash,
        string          category,
        string          targetGroup,
        uint256         timestamp
    );

    modifier onlyProfessor() {
        require(roleManager.hasRole(PROFESSOR_ROLE, msg.sender), "Not a professor");
        _;
    }

    constructor(address _roleManager) {
        roleManager = IAccessControl(_roleManager);
    }

    function publish(
        bytes32        contentHash,
        string calldata category,
        string calldata targetGroup,
        string calldata content
    ) external onlyProfessor returns (uint256) {
        uint256 id = ++_counter;
        announcements[id] = Announcement({
            id:          id,
            publisher:   msg.sender,
            contentHash: contentHash,
            category:    category,
            targetGroup: targetGroup,
            content:     content,
            timestamp:   block.timestamp
        });
        emit AnnouncementPublished(id, msg.sender, contentHash, category, targetGroup, block.timestamp);
        return id;
    }

    function verify(uint256 announcementId, bytes32 contentHash) external view returns (bool) {
        return announcements[announcementId].contentHash == contentHash;
    }

    function getAnnouncements(string calldata group) external view returns (Announcement[] memory) {
        bytes32 groupHash = keccak256(bytes(group));
        bytes32 allHash   = keccak256(bytes("all"));

        uint256 count;
        for (uint256 i = 1; i <= _counter; i++) {
            bytes32 tg = keccak256(bytes(announcements[i].targetGroup));
            if (tg == groupHash || tg == allHash) count++;
        }

        Announcement[] memory result = new Announcement[](count);
        uint256 idx;
        for (uint256 i = 1; i <= _counter; i++) {
            bytes32 tg = keccak256(bytes(announcements[i].targetGroup));
            if (tg == groupHash || tg == allHash) {
                result[idx++] = announcements[i];
            }
        }
        return result;
    }

    function totalAnnouncements() external view returns (uint256) {
        return _counter;
    }
}
