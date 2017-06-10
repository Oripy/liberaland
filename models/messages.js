const mongoose = require('mongoose');
const Schema = mongoose.Schema;

// MongoDB Schema for Chat messages
var MessagesSchema = Schema(
  {
    // id of the author from Users Schema
    user: {type: Schema.ObjectId, ref: 'Users', required: true},
    // message content
    message: {type: String, required: true},
    // id of the parent message ("chat" if not child)
    parent: {type: String},
    // true: this message have been checked by the Game Master
    checked: {type: Boolean, default: false}
  }
);

//Export model
module.exports = mongoose.model('Messages', MessagesSchema);
