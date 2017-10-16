/**
 * Token manager for the socket.io connection
 *
 * Created by kc on 10.05.15.
 */

const uuid     = require('uuid');
const mongoose = require('mongoose');
const tokens   = {};

const tokenSchema = mongoose.Schema({
  login     : String,
  id        : String,
  issueDate : {type: Date, default: Date.now},
  expiryDate: Date
});

const Token = mongoose.model('Token', tokenSchema);

function getToken(user, callback) {
  Token.find()
    .where('login').equals(user)
    .exec(function (err, docs) {
      if (err) {
        return callback(err);
      }
      if (!docs || docs.length === 0) {
        return callback();
      }
      callback(err, docs[0]);
    });
}


module.exports = {
  /**
   * Generate a new token
   * @param user
   * @param callback
   */
  getNewToken: function (user, callback) {
    getToken(user, function (err, token) {
      if (err) {
        return callback(err);
      }
      if (!token) {
        token = new Token();
      }
      token.id    = uuid.v4();
      token.login = user;
      token.save(function (err) {
        callback(err, token.id);
      });
    });
  },

  /**
   * Verifies a token
   * @param user
   * @param userToken
   * @param callback
   * @returns {*}
   */
  verifyToken: function (user, userToken, callback) {
    if (tokens[user]) {
      if (tokens[user].id === userToken) {
        return callback(null);
      }
    }
    getToken(user, function (err, token) {
      if (err) {
        return callback(err);
      }
      if (!token) {
        return callback(new Error('No token retrieved in verifyToken!'));
      }
      if (userToken === token.id) {
        tokens[user] = token;
        return callback(null);
      }
      callback(new Error('invalid token'));
    });
  }
};
