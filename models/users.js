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
    // flag if user has access to admin pages
    admin: {type: Boolean, default: false}
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
