var testurl = new RegExp('^(?:[a-z]+:)?//', 'i');

var map = [];
var chunk_selected;
var num_lines = 0;
var approve_item = function() { return undefined; };
var add_item = function() { return undefined; };
var map_select = function() { return undefined; };

function strToNum(value) {
  var out = 0;
  value = value.toUpperCase();
  for (var i = 0; i < value.length; i++) {
    out += (value[i].charCodeAt() - 65)*Math.pow(26, value.length-i-1);
  }
  return out;
}
function numToStr(value) {
  var out = "";
  do {
    var remainder = value % 26;
    value = Math.floor(value/26);
    out = String.fromCharCode(remainder + 65) + out;
  } while (value > 0);
  return out;
}
function url_check(value) {
  if (testurl.test(value)) {
    var url = value;
  } else {
    var url = "../"+value;
  }
  return url;
}

window.onload = function() {
  var socket = io.connect();
  socket.on('server update', function() {
    socket.emit('load_admin');
  });

  approve_item = function(elt) {
    socket.emit('approve_item', {
      id: elt.id,
      approved: elt.checked
    });
  }

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

  map_save = function() {
    var x = parseInt(strToNum(document.getElementById('map_coord_x').value));
    var y = parseInt(document.getElementById('map_coord_y').value);
    var type = document.getElementById('map_type').value;
    var items = [];
    for (var i = 0; i < num_lines; i++) {
      var item = document.getElementById('map_item_'+i).value;
      var number = document.getElementById('map_number_'+i).value;
      if ((item != "") && (number != "")) {
        items.push({
          name: item,
          number: number
        });
      }
    }
    var newdoc = {
      x: x,
      y: y,
      type: type,
      items: JSON.stringify(items)
    };
    socket.emit('change_chunk', newdoc);
  }

  map_select = function(elt) {
    if (elt) {
      if (elt != chunk_selected) {
        var x = parseInt(elt.getAttribute("coordx"));
        var y = parseInt(elt.getAttribute("coordy"));
        if (chunk_selected) {
          chunk_selected.removeAttribute("bgColor");
        }
        chunk_selected = elt;
        chunk_selected.setAttribute("bgColor", "LightBlue");
        document.getElementById('map_coords').innerHTML = '<input size=1 id="map_coord_x" value="'+numToStr(x)+'">, <input size=1 id="map_coord_y" value="'+y+'">';
        if (map[x]) {
          if (map[x][y]) {
            document.getElementById('map_type').value = map[x][y].type;
            var list_items = map[x][y].items;
            var out = "";
            num_lines = 0;
            document.getElementById('inserted_items').innerHTML = "";
            for (let i = 0; i < list_items.length; i++) {
              insert_item(list_items[i].number, list_items[i].item.name);
            }
          }
        }
      }
    }
  }

  insert_item = function(number = "", name = "") {
    document.getElementById('inserted_items').insertAdjacentHTML('beforeend', '<input id="map_number_'+num_lines+'" type="number" value="'+number+'"><input id="map_item_'+num_lines+'" list="items_list" type="text" value="'+name+'"><br>');
    num_lines++;
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
          out += item.number+'<img class="items" src="'+url_check(item.item.image)+'" title="'+item.item.name+'"><br>';
        }
      }
      out += "</td></tr>";
    }
    out += "</table>";
    document.getElementById('users').innerHTML = out;
  });

  socket.on('load_items', function(items) {
    var out = "<table><thead><tr><th>approvés</th><th>nom</th><th>image</th><th>image petit</th><th>image url</th></tr></thead>";
    var datalist = '<datalist id="items_list">';
    for (let i = 0; i < items.length; i++) {
      datalist += '<option value='+items[i].name+'>';
      url = url_check(items[i].image);
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
    out += datalist+'</datalist>';
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
    out += '<tr><td style="width:15px;border-style:none;"></td>';
    for (let j = min_y; j < max_y+1; j++) {
      out += '<th align="center">'+j+'</th>';
    }
    out += '<td style="width:15px;border-style:none;"></td></tr>';
    for (let i = min_x; i < max_x+1; i++) {
      out += '<tr><th align="center">'+numToStr(i)+'</th>';
      for (let j = min_y; j < max_y+1; j++) {
        out += '<td coordx="'+i+'" coordy="'+j+'" onclick="map_select(this)"">';
        if (map[i]) {
          if (map[i][j]) {
            out += map[i][j].type+"<br>";
            var items = map[i][j].items;
            for (let k = 0; k < items.length; k++) {
              out += items[k].number+'<img class="items" src="'+url_check(items[k].item.image)+'">; ';
            }
          }
        }
        out += '</td>';
      }
      out += '<th align="center">'+numToStr(i)+'</th></tr>';
    }
    out += '<tr><td style="width:15px;border-style:none;"></td>';
    for (let j = min_y-1; j < max_y+2; j++) {
      out += '<th align="center">'+j+'</th>';
    }
    out += '<td style="width:15px;border-style:none;"></td></tr>';
    out += '</table>';
    document.getElementById('map').innerHTML = out;
    map_select(chunk_selected);
  });
}
