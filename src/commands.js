/**
 * Command handler for chat commands
 * Parses and dispatches commands like !votban, !yes, !no, !votestatus
 */

const logger = require('./logger');

class CommandHandler {
  constructor(context) {
    this.context = context; // voteManager, client, config, etc.
    this.commands = this.setupCommands();
  }

  /**
   * Setup available commands
   * @returns {Object} - Command handlers map
   */
  setupCommands() {
    return {
      '!votban': this.handleVotban.bind(this),
      '!yes': this.handleYes.bind(this),
      '!no': this.handleNo.bind(this),
      '!votestatus': this.handleVoteStatus.bind(this),
      '!cancelVote': this.handleCancelVote.bind(this),
      '!help': this.handleHelp.bind(this),
    };
  }

  /**
   * Parse and execute command
   * @param {string} username - User executing command
   * @param {string} text - Chat message
   * @returns {string|null} - Response to send to chat
   */
  parse(username, text) {
    // Extract command and arguments
    const parts = text.split(' ');
    const command = parts[0].toLowerCase();
    const args = parts.slice(1);

    if (!this.commands[command]) {
      return null; // Not a recognized command
    }

    logger.debug(`Command: ${command} from ${username}`, args);

    try {
      return this.commands[command](username, args);
    } catch (error) {
      logger.error(`Error executing command ${command}`, error);
      return 'An error occurred executing that command.';
    }
  }

  /**
   * Handle !votban <username> command
   * Initiates a vote to ban a user
   */
  handleVotban(username, args) {
    // Check if user is a moderator (simplified check)
    const isMod = this.isModerator(username);
    if (!isMod) {
      return 'Only moderators can initiate votes.';
    }

    if (args.length === 0) {
      return 'Usage: !votban @username';
    }

    const targetUser = args[0].replace('@', '').toLowerCase();

    if (targetUser === username.toLowerCase()) {
      return 'You cannot vote to ban yourself.';
    }

    if (this.context.voteManager.hasActiveVote()) {
      const status = this.context.voteManager.getVoteStatus();
      return `Vote already active for ${status.target}. Use !cancelVote to cancel.`;
    }

    const success = this.context.voteManager.startVote(targetUser, username);

    if (!success) {
      return `Failed to start vote for ${targetUser}.`;
    }

    return `Vote started to ban ${targetUser}! Type !yes to vote for the ban (need ${this.context.config.voteThreshold} votes).`;
  }

  /**
   * Handle !yes command
   * Vote in favor of the ban
   */
  handleYes(username, args) {
    if (!this.context.voteManager.hasActiveVote()) {
      return 'No active vote.';
    }

    const result = this.context.voteManager.addVote(username);

    if (!result.isMet) {
      return `Vote recorded! ${result.votes}/${result.threshold} votes needed.`;
    }

    // Threshold met!
    const voteResult = this.context.voteManager.endVote(true);
    const banMsg = `Chat voted to ban ${voteResult.target} for ${this.context.config.banDurationMinutes} minutes!`;

    // TODO: Execute ban via Twitch API
    logger.info(
      `Ban executed: ${voteResult.target} by ${voteResult.initiator}`
    );

    return banMsg;
  }

  /**
   * Handle !no command
   * Vote against the ban
   */
  handleNo(username, args) {
    if (!this.context.voteManager.hasActiveVote()) {
      return 'No active vote.';
    }

    // For now, !no just acknowledges the command
    // Extended feature: could count downvotes and cancel vote if threshold is high
    return 'Vote against ban recorded.';
  }

  /**
   * Handle !votestatus command
   * Show current vote status
   */
  handleVoteStatus(username, args) {
    const status = this.context.voteManager.getVoteStatus();

    if (!status) {
      return 'No active vote.';
    }

    return `Vote for ${status.target}: ${status.votes}/${status.threshold} votes (${status.percentage}%)`;
  }

  /**
   * Handle !cancelVote command
   * Cancel current vote (moderators only)
   */
  handleCancelVote(username, args) {
    const isMod = this.isModerator(username);
    if (!isMod) {
      return 'Only moderators can cancel votes.';
    }

    const cancelled = this.context.voteManager.cancelVote();

    if (!cancelled) {
      return 'No active vote to cancel.';
    }

    return 'Vote cancelled by moderator.';
  }

  /**
   * Handle !help command
   * Show available commands
   */
  handleHelp(username, args) {
    const commands = [
      '!votban @user - Start a vote to ban a user (mods only)',
      '!yes - Vote for the ban',
      '!no - Vote against the ban',
      '!votestatus - Show current vote status',
      '!cancelVote - Cancel current vote (mods only)',
    ];

    return `Available commands: ${commands.join(' | ')}`;
  }

  /**
   * Check if user is a moderator
   * TODO: Implement proper moderator check with Twitch API
   * For now, just check against a simple list or check message tags
   */
  isModerator(username) {
    // TODO: Check user badges from Twitch IRC tags
    // For demo, allow specific users or check if bot owner
    return (
      username.toLowerCase() === this.context.config.channel.toLowerCase() ||
      (this.context.config.moderators &&
        this.context.config.moderators.includes(username.toLowerCase()))
    );
  }
}

module.exports = CommandHandler;
