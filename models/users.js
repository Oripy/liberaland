const mongoose = require('mongoose');
const Schema = mongoose.Schema;

// MongoDB Schema for Users
var UsersSchema = Schema(
  {
    // name of the user (lowercase)
    name: {type: String, required: true, max: 100},
    // display name of the user (case sensitive)
    truename: {type: String, max: 100},
    // salf for password hashing
    salt: {type: String, required: true},
    // hash of the password
    hash: {type: String, required: true},
    // array of map coordinates belonging to this player
    properties: [{type: Schema.ObjectId, ref: 'Map'}],
    // array of items belonging to this player
    items: [{
      item: {type: Schema.ObjectId, ref: 'Items'},
      number: {type: Number}
    }]
  }
);

// Virtual for author's full name
// UsersSchema
// .virtual('name')
// .get(function () {
  // return this.family_name + ', ' + this.first_name;
// });

// Virtual for author's URL
// UsersSchema
// .virtual('url')
// .get(function () {
  // return '/catalog/author/' + this._id;
// });

//Export model
module.exports = mongoose.model('Users', UsersSchema);
