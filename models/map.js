const mongoose = require('mongoose');
const Schema = mongoose.Schema;

// MongoDB Schema for the map chunk data
var MapSchema = Schema(
  {
    // x coordinate
    x: {type: Number, required: true},
    // y coordinate
    y: {type: Number, required: true},
    // array of items in this map chunk
    items: [{
      // link to id of the Items Schema
      item: {type: Schema.ObjectId, ref: 'Items'},
      // number of this particular item in the map chunk
      number: {type: Number}
    }]
  }
);

//Export model
module.exports = mongoose.model('Map', MapSchema);
