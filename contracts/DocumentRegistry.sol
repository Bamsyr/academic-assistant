// SPDX-License-Identifier: MIT
pragma solidity ^0.8.24;

import "@openzeppelin/contracts/access/IAccessControl.sol";

contract DocumentRegistry {
    bytes32 public constant PROFESSOR_ROLE = keccak256("PROFESSOR_ROLE");

    struct Document {
        uint256 id;
        address publisher;
        bytes32 fileHash;
        string  fileName;
        string  targetGroup;
        uint256 timestamp;
    }

    IAccessControl public immutable roleManager;
    uint256 private _counter;
    mapping(uint256 => Document) public documents;

    event DocumentRegistered(
        uint256 indexed id,
        address indexed publisher,
        bytes32         fileHash,
        string          fileName,
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

    function register(
        bytes32        fileHash,
        string calldata fileName,
        string calldata targetGroup
    ) external onlyProfessor returns (uint256) {
        uint256 id = ++_counter;
        documents[id] = Document({
            id:          id,
            publisher:   msg.sender,
            fileHash:    fileHash,
            fileName:    fileName,
            targetGroup: targetGroup,
            timestamp:   block.timestamp
        });
        emit DocumentRegistered(id, msg.sender, fileHash, fileName, targetGroup, block.timestamp);
        return id;
    }

    function verifyDocument(uint256 docId, bytes32 fileHash) external view returns (bool) {
        return documents[docId].fileHash == fileHash;
    }

    function getDocuments(string calldata group) external view returns (Document[] memory) {
        bytes32 groupHash = keccak256(bytes(group));
        bytes32 allHash   = keccak256(bytes("all"));

        uint256 count;
        for (uint256 i = 1; i <= _counter; i++) {
            bytes32 tg = keccak256(bytes(documents[i].targetGroup));
            if (tg == groupHash || tg == allHash) count++;
        }

        Document[] memory result = new Document[](count);
        uint256 idx;
        for (uint256 i = 1; i <= _counter; i++) {
            bytes32 tg = keccak256(bytes(documents[i].targetGroup));
            if (tg == groupHash || tg == allHash) {
                result[idx++] = documents[i];
            }
        }
        return result;
    }

    function totalDocuments() external view returns (uint256) {
        return _counter;
    }
}
