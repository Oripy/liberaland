const mongoose = require('mongoose');
const Schema = mongoose.Schema;

// MongoDB Schema for the map chunk data
var StatusSchema = Schema(
  {
    // world
    world: {type: Schema.ObjectId, ref: 'World'},
    // turn
    turn: {type: Number},
    // user Id
    user: {type: Schema.ObjectId, ref: 'Users'},
    // array of map coordinates belonging to this player
    properties: [{type: Schema.ObjectId, ref: 'Map'}],
    // number of VP of this user
    victory_points: {type: Number},
    // array of items belonging to this player
    items: [{
      item: {type: Schema.ObjectId, ref: 'Items'},
      number: {type: Number}
    }]
  }
);
//Export model
module.exports = mongoose.model('Status', StatusSchema);
