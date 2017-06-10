var testurl = new RegExp('^(?:[a-z]+:)?//', 'i');
var approve_item = function() { return undefined; };
var add_item = function() { return undefined; };

window.onload = function() {
  var socket = io.connect();

  approve_item = function(elt) {
    console.log('fired');
    socket.emit('approve_item', {
      id: elt.id,
      approved: elt.checked
    });
  }

  socket.on('server update', function() {
    socket.emit('load_admin');
  });

  add_item = function() {
    var name = document.getElementById('item_name').value;
    var image = document.getElementById('item_image').value;
    if ((name != "") && (image != "")) {
      socket.emit('new item', {
        name: name,
        image: image
      });
    }
  }

  socket.on('load_users', function(users) {
    var out = "<table><thead><tr><th>admin</th><th>nom</th><th>vrai nom</th><th>propriétés</th><th>objets</th></tr></thead>";
    for (let i = 0; i < users.length; i++) {
      out += "<tr><td>";
      if (users[i].admin === true) {
        out += "Oui";
      }
      out += "</td><td>";
      if (users[i].name) {
        out += users[i].name;
      }
      out += "</td><td>";
      if (users[i].truename) {
        out += users[i].truename;
      }
      out += "</td><td>";
      if (users[i].properties) {
        for (let prop in users[i].properties) {
          out += "["+String.fromCharCode(users[i].properties.x + 64)+users[i].properties.y+"] ";
        }
      }
      out += "</td><td>";
      if (users[i].items) {
        for (let item in users[i].items) {
          out += item.number+'<img class="items" src="'+item.item.image+'" title="'+item.item.name+'"><br>';
        }
      }
      out += "</td></tr>";
    }
    out += "</table>";
    document.getElementById('users').innerHTML = out;
  });

  socket.on('load_items', function(items) {
    var out = "<table><thead><tr><th>approvés</th><th>nom</th><th>image</th><th>image petit</th><th>image url</th></tr></thead>";
    for (let i = 0; i < items.length; i++) {
      if (testurl.test(items[i].image)) {
        var url = items[i].image;
      } else {
        var url = "../"+items[i].image;
      }
      out += "<tr><td>";
      if (items[i].approved === true) {
        out += '<input type="checkbox" onclick="approve_item(this)" id="'+items[i]._id+'" checked>';
      } else {
        out += '<input type="checkbox" onclick="approve_item(this)"  id="'+items[i]._id+'">';
      }
      out += "</td><td>";
      if (items[i].name) {
        out += items[i].name;
      }
      out += "</td><td>";
      if (items[i].image) {
        out += '<img src="'+url+'">';
      }
      out += "</td><td>";
      if (items[i].image) {
        out += '<img class="items" src="'+url+'">';
      }
      out += "</td><td>";
      if (items[i].image) {
        out += items[i].image;
      }
      out += "</td></tr>";
    }
    out += '<tr><td>Ajout :</td><td><input type="text" id="item_name"></td><td><input type="text" id="item_image"></td><td><button onclick="add_item()">Ajouter</button></td></tr></table>';
    document.getElementById('items').innerHTML = out;
  });

  socket.on('load_map', function(tiles) {
    var out = '<table id="mapview">';
    min_x = Infinity;
    min_y = Infinity;
    max_x = 0;
    max_y = 0;
    map = [];
    for (let i = 0; i < tiles.length; i++) {
      min_x = Math.min(min_x, tiles[i].x);
      min_y = Math.min(min_y, tiles[i].y);
      max_x = Math.max(max_x, tiles[i].x);
      max_y = Math.max(max_y, tiles[i].y);
      if (!map[tiles[i].x]) {
        map[tiles[i].x] = [];
      }
      map[tiles[i].x][tiles[i].y] = tiles[i];
    }
    for (let i = min_x; i < max_x+1; i++) {
      out += '<tr>';
      for (let j = min_y; j < max_y+1; j++) {
        out += '<td>';
        if (map[i]) {
          if (map[i][j]) {
            out += map[i][j].type;
            for (let k = 0; k < map[i][j].items.length; k++) {
              out += map[i][j].items[k].number+'<img class="items" src="'+map[i][j].items[k].item.image+'"><br>';
            }
          }
        }
        out += '</td>';
      }
      out += '</tr>';
    }
    out += '</table>';
    document.getElementById('map').innerHTML = out;
  });
}
