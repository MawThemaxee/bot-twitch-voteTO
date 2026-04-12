/**
 * Vote Manager - handles vote tracking and ban logic
 * Tracks active votes and executes bans when threshold is met
 */

const logger = require('./logger');

class VoteManager {
  constructor(threshold = 3, banDurationMinutes = 5) {
    this.threshold = threshold;
    this.banDurationMinutes = banDurationMinutes;
    this.activeVote = null;
    this.voteTimeouts = new Map(); // Track vote timeouts
  }

  /**
   * Start a new vote for banning a user
   * @param {string} targetUser - Username to vote on
   * @param {string} initiator - Username who started the vote
   * @returns {boolean} - True if vote started, false if one already active
   */
  startVote(targetUser, initiator) {
    if (this.activeVote) {
      logger.warn(
        `Vote already active for ${this.activeVote.target}, cannot start new vote`
      );
      return false;
    }

    this.activeVote = {
      target: targetUser,
      initiator: initiator,
      votes: new Set(),
      startTime: Date.now(),
      expiresAt: Date.now() + 60000, // Vote expires in 60 seconds
    };

    logger.info(`Vote started for ${targetUser} by ${initiator}`);

    // Auto-expire vote after 60 seconds
    const timeout = setTimeout(() => {
      logger.info(
        `Vote for ${targetUser} expired (${this.activeVote.votes.size}/${this.threshold} votes)`
      );
      this.endVote(false);
    }, 60000);

    this.voteTimeouts.set(targetUser, timeout);

    return true;
  }

  /**
   * Add a vote from a user
   * @param {string} username - Username voting
   * @returns {Object} - { votes, threshold, isMet }
   */
  addVote(username) {
    if (!this.activeVote) {
      return { votes: 0, threshold: this.threshold, isMet: false };
    }

    // Prevent duplicate votes from same user
    if (this.activeVote.votes.has(username)) {
      logger.debug(`${username} already voted, ignoring duplicate`);
      return {
        votes: this.activeVote.votes.size,
        threshold: this.threshold,
        isMet: false,
      };
    }

    this.activeVote.votes.add(username);
    const voteCount = this.activeVote.votes.size;
    const isMet = voteCount >= this.threshold;

    logger.info(
      `Vote added: ${voteCount}/${this.threshold} for ${this.activeVote.target}`
    );

    return { votes: voteCount, threshold: this.threshold, isMet };
  }

  /**
   * Check if threshold is met
   * @returns {boolean}
   */
  isThresholdMet() {
    if (!this.activeVote) return false;
    return this.activeVote.votes.size >= this.threshold;
  }

  /**
   * Get current vote status
   * @returns {Object|null} - Current vote info or null if no active vote
   */
  getVoteStatus() {
    if (!this.activeVote) return null;

    return {
      target: this.activeVote.target,
      votes: this.activeVote.votes.size,
      threshold: this.threshold,
      percentage: Math.round(
        (this.activeVote.votes.size / this.threshold) * 100
      ),
      voters: Array.from(this.activeVote.votes),
    };
  }

  /**
   * End the current vote (success or failure)
   * @param {boolean} success - Whether vote passed
   * @returns {Object|null} - Vote result or null
   */
  endVote(success) {
    if (!this.activeVote) return null;

    const result = {
      target: this.activeVote.target,
      initiator: this.activeVote.initiator,
      votes: this.activeVote.votes.size,
      threshold: this.threshold,
      success: success,
      reason: success ? 'Threshold met' : 'Vote expired',
    };

    // Clear timeout
    const timeout = this.voteTimeouts.get(this.activeVote.target);
    if (timeout) {
      clearTimeout(timeout);
      this.voteTimeouts.delete(this.activeVote.target);
    }

    this.activeVote = null;
    return result;
  }

  /**
   * Cancel the current vote
   * @returns {boolean} - True if vote was cancelled
   */
  cancelVote() {
    if (!this.activeVote) return false;

    logger.info(`Vote for ${this.activeVote.target} cancelled`);
    const timeout = this.voteTimeouts.get(this.activeVote.target);
    if (timeout) {
      clearTimeout(timeout);
      this.voteTimeouts.delete(this.activeVote.target);
    }

    this.activeVote = null;
    return true;
  }

  /**
   * Check if a vote is currently active
   * @returns {boolean}
   */
  hasActiveVote() {
    return this.activeVote !== null;
  }
}

module.exports = VoteManager;
