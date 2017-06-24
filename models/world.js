const mongoose = require('mongoose');
const Schema = mongoose.Schema;

// MongoDB Schema for the map chunk data
var WorldSchema = Schema(
  {
    name: {type: String, required: true},
    last_turn: {type: Number, default: 1, required: true},
  }
);

//Export model
module.exports = mongoose.model('World', WorldSchema);
