// SPDX-License-Identifier: MIT
pragma solidity ^0.8.27;

import {
    FHE,
    ebool,
    euint32,
    externalEuint32
} from "@fhevm/solidity/lib/FHE.sol";
import {SepoliaConfig} from "@fhevm/solidity/config/ZamaConfig.sol";

/// @title CommunityVoting - Privacy-preserving community election voting system
/// @notice Enables users to vote for four community committee candidates with encrypted votes
/// @dev All votes are encrypted and cannot be seen by others until decryption
contract CommunityVoting is SepoliaConfig {
    uint256 public constant NUM_CANDIDATES = 4;
    
    // Candidate IDs: 0, 1, 2, 3
    uint8 public constant CANDIDATE_1 = 0;
    uint8 public constant CANDIDATE_2 = 1;
    uint8 public constant CANDIDATE_3 = 2;
    uint8 public constant CANDIDATE_4 = 3;

    struct VoteData {
        euint32 candidate1Votes;  // Encrypted vote count for candidate 1
        euint32 candidate2Votes;  // Encrypted vote count for candidate 2
        euint32 candidate3Votes;  // Encrypted vote count for candidate 3
        euint32 candidate4Votes;  // Encrypted vote count for candidate 4
        euint32 totalVotes;       // Encrypted total vote count
    }

    VoteData public voteData;
    
    // Track if user has voted
    mapping(address => bool) public hasVoted;
    
    // Track encrypted vote for each user (for viewing/verification)
    mapping(address => euint32) public userVotes;
    
    // Event emitted when a user votes
    event VoteCast(address indexed voter, uint8 candidate, euint32 encryptedVote);
    
    // Event emitted when vote counts are updated
    event VoteCountsUpdated(
        euint32 candidate1Votes,
        euint32 candidate2Votes,
        euint32 candidate3Votes,
        euint32 candidate4Votes,
        euint32 totalVotes
    );

    // Candidate names for better UX
    string[4] public candidateNames = [
        "Community Development Lead",
        "Treasury Manager",
        "Events Coordinator",
        "Technical Advisor"
    ];

    /// @notice Initialize the voting system with encrypted zeros
    constructor() {
        // Initialize all vote counts to encrypted zero
        voteData.candidate1Votes = FHE.asEuint32(0);
        voteData.candidate2Votes = FHE.asEuint32(0);
        voteData.candidate3Votes = FHE.asEuint32(0);
        voteData.candidate4Votes = FHE.asEuint32(0);
        voteData.totalVotes = FHE.asEuint32(0);
        
        // Grant permissions to all users for viewing encrypted totals
        FHE.allowThis(voteData.candidate1Votes);
        FHE.allowThis(voteData.candidate2Votes);
        FHE.allowThis(voteData.candidate3Votes);
        FHE.allowThis(voteData.candidate4Votes);
        FHE.allowThis(voteData.totalVotes);
    }

    /// @notice Cast a vote for a candidate (0-3)
    /// @param encryptedCandidate The encrypted candidate ID (0-3)
    /// @param inputProof The input proof for the encrypted candidate ID
    function vote(
        externalEuint32 encryptedCandidate,
        bytes calldata inputProof
    ) external {
        require(!hasVoted[msg.sender], "CommunityVoting: already voted");
        
        // Convert external encrypted value to internal
        euint32 candidate = FHE.fromExternal(encryptedCandidate, inputProof);
        
        // Store encrypted vote for this user (for verification/viewing)
        userVotes[msg.sender] = candidate;
        
        // Grant permission for user to decrypt their own vote
        FHE.allow(candidate, msg.sender);
        FHE.allowThis(candidate);
        
        // Create encrypted 1 for incrementing vote count
        euint32 one = FHE.asEuint32(1);
        
        // Check which candidate was voted for and increment their count
        ebool isCandidate1 = FHE.eq(candidate, FHE.asEuint32(CANDIDATE_1));
        ebool isCandidate2 = FHE.eq(candidate, FHE.asEuint32(CANDIDATE_2));
        ebool isCandidate3 = FHE.eq(candidate, FHE.asEuint32(CANDIDATE_3));
        ebool isCandidate4 = FHE.eq(candidate, FHE.asEuint32(CANDIDATE_4));
        
        // Increment the corresponding candidate's vote count
        voteData.candidate1Votes = FHE.select(isCandidate1, 
            FHE.add(voteData.candidate1Votes, one), 
            voteData.candidate1Votes
        );
        voteData.candidate2Votes = FHE.select(isCandidate2,
            FHE.add(voteData.candidate2Votes, one),
            voteData.candidate2Votes
        );
        voteData.candidate3Votes = FHE.select(isCandidate3,
            FHE.add(voteData.candidate3Votes, one),
            voteData.candidate3Votes
        );
        voteData.candidate4Votes = FHE.select(isCandidate4,
            FHE.add(voteData.candidate4Votes, one),
            voteData.candidate4Votes
        );
        
        // Increment total votes
        voteData.totalVotes = FHE.add(voteData.totalVotes, one);
        
        // Re-authorize contract to decrypt updated vote counts (important for mock mode)
        FHE.allowThis(voteData.candidate1Votes);
        FHE.allowThis(voteData.candidate2Votes);
        FHE.allowThis(voteData.candidate3Votes);
        FHE.allowThis(voteData.candidate4Votes);
        FHE.allowThis(voteData.totalVotes);

        // Mark user as having voted
        hasVoted[msg.sender] = true;
        
        // Emit events
        emit VoteCast(msg.sender, 0, candidate); // candidate value is encrypted, 0 is placeholder
        emit VoteCountsUpdated(
            voteData.candidate1Votes,
            voteData.candidate2Votes,
            voteData.candidate3Votes,
            voteData.candidate4Votes,
            voteData.totalVotes
        );
    }

    /// @notice Get the encrypted vote counts for all candidates
    /// @return candidate1Votes Encrypted vote count for candidate 1
    /// @return candidate2Votes Encrypted vote count for candidate 2
    /// @return candidate3Votes Encrypted vote count for candidate 3
    /// @return candidate4Votes Encrypted vote count for candidate 4
    /// @return totalVotes Encrypted total vote count
    function getVoteCounts() external view returns (
        euint32 candidate1Votes,
        euint32 candidate2Votes,
        euint32 candidate3Votes,
        euint32 candidate4Votes,
        euint32 totalVotes
    ) {
        return (
            voteData.candidate1Votes,
            voteData.candidate2Votes,
            voteData.candidate3Votes,
            voteData.candidate4Votes,
            voteData.totalVotes
        );
    }

    /// @notice Get the encrypted vote of a specific user
    /// @param voter The address of the voter
    /// @return The encrypted vote (candidate ID)
    function getUserVote(address voter) external view returns (euint32) {
        return userVotes[voter];
    }

    /// @notice Check if a user has voted
    /// @param voter The address of the voter
    /// @return Whether the user has voted
    function checkHasVoted(address voter) external view returns (bool) {
        return hasVoted[voter];
    }

    /// @notice Authorize a user to decrypt vote counts (useful for mock mode)
    /// @param user The address of the user to authorize
    function authorizeUserForDecryption(address user) external {
        // Grant permission for user to decrypt all vote counts
        FHE.allow(voteData.candidate1Votes, user);
        FHE.allow(voteData.candidate2Votes, user);
        FHE.allow(voteData.candidate3Votes, user);
        FHE.allow(voteData.candidate4Votes, user);
        FHE.allow(voteData.totalVotes, user);
    }

    /// @notice Get the name of a candidate by ID
    /// @param candidateId The ID of the candidate (0-3)
    /// @return The name of the candidate
    function getCandidateName(uint8 candidateId) external view returns (string memory) {
        require(candidateId < NUM_CANDIDATES, "CommunityVoting: invalid candidate ID");
        return candidateNames[candidateId];
    }
}

