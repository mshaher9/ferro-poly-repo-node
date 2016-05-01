/**
 * This is the account of a TEAM: every transaction, positive or negative, is done
 * over this module.
 * Created by kc on 19.04.15.
 */

var _                      = require('lodash');
var teamAccountTransaction = require('./../../../common/models/accounting/teamAccountTransaction');
var moment                 = require('moment');
var logger                 = require('../../../common/lib/logger').getLogger('accounting:teamAccount');
var teamAccountActions     = require('../../components/checkin-datastore/lib/teamAccount/actions');

var ferroSocket;
/**
 * Pays the interest for one team
 * @param teamId
 * @param gameId
 * @param amount
 * @param callback
 */
function payInterest(teamId, gameId, amount, callback) {
  if (!teamId || !gameId || !_.isNumber(amount)) {
    callback(new Error('Parameter error in payInterest'));
    return;
  }
  var entry                = new teamAccountTransaction.Model();
  entry.gameId             = gameId;
  entry.teamId             = teamId;
  entry.transaction.amount = amount;
  entry.transaction.origin = {category: 'bank'};
  entry.transaction.info   = 'Startgeld';
  teamAccountTransaction.book(entry, function (err) {
    callback(err);
    if (ferroSocket) {
      ferroSocket.emitToAdmins(gameId, 'admin-teamAccount', {cmd: 'onTransaction', data: entry});
      ferroSocket.emitToTeam(gameId, teamId, 'checkinStore', teamAccountActions.addTransaction(entry));
    }
  });
}

/**
 * Internal function, charging to bank or chancellery
 * @param options with at least:
 *  - teamId
 *  - gameId
 *  - amount   amount to pay (will be always turned to a negative value)
 *  - info     optional text to be supplied with the transaction or object
 *  - user     optional: user which initiated transaction
 *  - category
 * @param callback
 * @returns {*}
 */
function chargeToBankOrChancellery(options, callback) {
  if (!options.teamId || !options.gameId || !_.isNumber(options.amount)) {
    callback(new Error('Parameter error in chargeToBank'));
    return;
  }

  if (options.amount === 0) {
    return callback(new Error('Value must not be 0'));
  }

  // Amount has to be negative, not concerning of the parameter value!
  var chargedAmount = (-1) * Math.abs(options.amount);

  var entry                = new teamAccountTransaction.Model();
  entry.gameId             = options.gameId;
  entry.teamId             = options.teamId;
  entry.transaction.amount = chargedAmount;
  entry.transaction.origin = {category: options.category};
  entry.user               = options.user;
  if (_.isString(options.info)) {
    entry.transaction.info = options.info;
  }
  else if (_.isObject(options.info)) {
    entry.transaction.info  = options.info.info;
    entry.transaction.parts = options.info.parts;
  }

  teamAccountTransaction.book(entry, function (err) {
    if (ferroSocket) {
      ferroSocket.emitToAdmins(options.gameId, 'admin-teamAccount', {cmd: 'onTransaction', data: entry});
      ferroSocket.emitToTeam(options.gameId, options.teamId, 'checkinStore', teamAccountActions.addTransaction(entry));
    }
    callback(err, {amount: chargedAmount});
  });
}
/**
 * Charging a teams account to the bank
 * @param options with at least:
 *  - teamId
 *  - gameId
 *  - amount   amount to pay (will be always turned to a negative value)
 *  - info     optional text to be supplied with the transaction or object
 * @param callback
 */
function chargeToBank(options, callback) {
  options.category = 'bank';
  chargeToBankOrChancellery(options, callback);
}

/**
 * Charging a teams account to the chancellery
 * @param options with at least:
 *  - teamId
 *  - gameId
 *  - amount   amount to pay (will be always turned to a negative value)
 *  - info     optional text to be supplied with the transaction or object
 * @param callback
 */
function chargeToChancellery(options, callback) {
  options.category = 'chancellery';
  chargeToBankOrChancellery(options, callback);
}

/**
 * Internal function for receiving money from bank or chancellery
 * @param teamId
 * @param gameId
 * @param amount
 * @param info
 * @param category
 * @param callback
 * @returns {*}
 */
function receiveFromBankOrChancellery(teamId, gameId, amount, info, category, callback) {
  try {
    if (!teamId || !gameId || !_.isNumber(amount)) {
      callback(new Error('Parameter error in chargeToBank'));
      return;
    }

    if (amount === 0) {
      return callback(new Error('Value must not be 0'));
    }

    var entry                = new teamAccountTransaction.Model();
    entry.gameId             = gameId;
    entry.teamId             = teamId;
    entry.transaction.amount = Math.abs(amount);
    entry.transaction.origin = {category: category};
    if (_.isString(info)) {
      entry.transaction.info = info;
    }
    else if (_.isObject(info)) {
      entry.transaction.info  = info.info;
      entry.transaction.parts = info.parts;
    }

    teamAccountTransaction.book(entry, function (err) {
      if (ferroSocket) {
        ferroSocket.emitToAdmins(gameId, 'admin-teamAccount', {cmd: 'onTransaction', data: entry});
        ferroSocket.emitToTeam(gameId, teamId, 'checkinStore', teamAccountActions.addTransaction(entry));
      }
      callback(err);
    });
  }
  catch (e) {
    logger.error(e);
    callback(e);
  }
}

/**
 * Get money for a teams account from the bank
 * @param teamId
 * @param gameId
 * @param amount   amount to pay (will be always turned to a positive value)
 * @param info     optional text to be supplied with the transaction or object
 * @param callback
 */
function receiveFromBank(teamId, gameId, amount, info, callback) {
  receiveFromBankOrChancellery(teamId, gameId, amount, info, 'bank', function (err) {
    callback(err);
  });
}

/**
 * Get money for a teams account from the chancellery
 * @param teamId
 * @param gameId
 * @param amount   amount to pay (will be always turned to a positive value)
 * @param info     optional text to be supplied with the transaction or object
 * @param callback
 */
function receiveFromChancellery(teamId, gameId, amount, info, callback) {
  receiveFromBankOrChancellery(teamId, gameId, amount, info, 'chancellery', function (err) {
    callback(err);
  });
}
/**
 * One team pays another one
 * @param options
 * @param callback
 */
function chargeToAnotherTeam(options, callback) {
  if (!options.debitorTeamId || !options.creditorTeamId || !options.info || !options.gameId || !_.isNumber(options.amount)) {
    callback(new Error('Parameter error in chargeToAnotherTeam'));
    return;
  }

  if (options.amount === 0) {
    return callback(new Error('Value must not be 0'));
  }

  // Amount has to be positive for us, not concerning of the parameter value!
  var chargedAmount = Math.abs(options.amount);

  var chargingEntry                = new teamAccountTransaction.Model();
  chargingEntry.gameId             = options.gameId;
  chargingEntry.teamId             = options.debitorTeamId;
  chargingEntry.user               = options.user;
  chargingEntry.transaction.amount = chargedAmount * (-1);
  chargingEntry.transaction.origin = {
    uuid    : options.creditorTeamId,
    category: 'team'
  };
  chargingEntry.transaction.info   = options.info;

  var receivingEntry                = new teamAccountTransaction.Model();
  receivingEntry.gameId             = options.gameId;
  receivingEntry.teamId             = options.creditorTeamId;
  receivingEntry.user               = options.user;
  receivingEntry.transaction.amount = chargedAmount;
  receivingEntry.transaction.origin = {uuid: options.debitorTeamId, category: 'team'};
  receivingEntry.transaction.info   = options.info;

  teamAccountTransaction.bookTransfer(chargingEntry, receivingEntry, function (err) {
    if (err) {
      return callback(err);
    }
    if (ferroSocket) {
      ferroSocket.emitToAdmins(options.gameId, 'admin-teamAccount', {cmd: 'onTransaction', data: chargingEntry});
      ferroSocket.emitToAdmins(options.gameId, 'admin-teamAccount', {cmd: 'onTransaction', data: receivingEntry});
      ferroSocket.emitToTeam(options.gameId, chargingEntry.teamId, 'checkinStore', teamAccountActions.addTransaction(chargingEntry));
      ferroSocket.emitToTeam(options.gameId, receivingEntry.teamId, 'checkinStore', teamAccountActions.addTransaction(receivingEntry));
    }
    callback(null, {amount: options.amount});
  });
}

/**
 * Gets the balance, at a given time or now
 * @param gameId
 * @param teamId
 * @param callback
 */
function getBalance(gameId, teamId, callback) {
  teamAccountTransaction.getBalance(gameId, teamId, function (err, value) {
    if (err) {
      return callback(err);
    }
    callback(err, {asset: value.asset, count: value.count});
  });
}

/**
 * Handles a negative balance at the end of a round: pay an interest.
 * @param gameId
 * @param teamId
 * @param rate : the rate of interest, a percentage between 0 and 100
 * @param callback
 */
function negativeBalanceHandling(gameId, teamId, rate, callback) {
  getBalance(gameId, teamId, function (err, info) {
    if (err) {
      return callback(err);
    }
    if (info.asset < 0) {
      var interest = Math.floor(Math.abs(info.asset * rate / 100));
      logger.info('Negative balance, pay interest ' + interest + ' from ' + info.asset);
      // Do not book here! The teamAccount does not have a connection to the chancellery, it's the
      // chancellerys job to book, we just make the calculation here.
      callback(null, {amount: interest});
    }
    else {
      callback();
    }
  });
}
/**
 * Returns the ranking list for a gameplay
 * @param gameId
 * @param callback
 */
function getRankingList(gameId, callback) {
  teamAccountTransaction.getRankingList(gameId, function (err, data) {
    if (err) {
      return callback(err);
    }
    var sorted = _.sortBy(_.values(data), function (n) {
      return n.asset * (-1);
    });
    for (var i = 0; i < sorted.length; i++) {
      sorted[i].teamId = sorted[i]._id;
      if (sorted[i - 1] && (sorted[i - 1].asset === sorted[i].asset)) {
        // Same asset, same rank
        sorted[i].rank = sorted[i - 1].rank;
      }
      else {
        sorted[i].rank = i + 1;
      }
    }
    callback(null, sorted);
  });
}

/**
 * Gets the account statement, all bookings up to a given time
 *
 * Param order p-params: [start] [end] callback
 * If only one param (start|end) is supplied, it is handled as start
 *
 * @param gameId
 * @param teamId
 * @param p1  Timestamp for start (moment, optional)
 * @param p2  Timestamp for end (moment, optional)
 * @param p3  Callback
 */
function getAccountStatement(gameId, teamId, p1, p2, p3) {
  var tsStart  = p1;
  var tsEnd    = p2;
  var callback = p3;
  if (_.isFunction(p1)) {
    callback = p1;
    tsStart  = undefined;
    tsEnd    = moment();
  }
  else if (_.isFunction(p2)) {
    callback = p2;
    tsStart  = p2;
    tsEnd    = moment();
  }
  if (!tsEnd) {
    tsEnd = moment();
  }

  teamAccountTransaction.getEntries(gameId, teamId, tsStart, tsEnd, function (err, data) {
    callback(err, data);
  });
}


module.exports = {
  payInterest            : payInterest,
  chargeToBank           : chargeToBank,
  chargeToChancellery    : chargeToChancellery,
  receiveFromBank        : receiveFromBank,
  receiveFromChancellery : receiveFromChancellery,
  chargeToAnotherTeam    : chargeToAnotherTeam,
  getBalance             : getBalance,
  negativeBalanceHandling: negativeBalanceHandling,
  getAccountStatement    : getAccountStatement,
  getRankingList         : getRankingList,

  init: function () {
    ferroSocket = require('../ferroSocket').get();

    if (!ferroSocket) {
      return;
    }
    ferroSocket.on('player-connected', function (data) {
      getBalance(data.gameId, data.teamId, function (err, info) {
        if (err) {
          logger.error(err);
          return;
        }
        ferroSocket.emitToTeam(data.gameId, data.teamId, 'checkinStore', teamAccountActions.setAsset(info.asset, info.count));

        getAccountStatement(data.gameId, data.teamId, function(err, transactions) {
          ferroSocket.emitToTeam(data.gameId, data.teamId, 'checkinStore', teamAccountActions.setTransactions(transactions));
          logger.info('Socket connected', info);
        });
      });
    });
  }
};
