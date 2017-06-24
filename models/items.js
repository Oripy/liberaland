const mongoose = require('mongoose');
const Schema = mongoose.Schema;

// MongoDB Schema for all items in the game
var ItemsSchema = Schema(
  {
    // world
    world: {type: Schema.ObjectId, ref: 'World'},
    // name of the item
    name: {type: String, required: true},
    // url of the image for this item
    image: {type: String},
    approved: {type: Boolean, default: false}
  }
);

//Export model
module.exports = mongoose.model('Items', ItemsSchema);
