var coordinates = /\[([a-zA-Z]+)([0-9]+)\]/g;
var item = /\{([\w]+)\}/g;
var action = /\*([\w]+)\*/g;
var player = /@([\w]+)/g;
var money = /([0-9]+)\$/g;

var user = null;
var msgselected = "chatview";
var newmsgs = [null,null,null,null,null,null,null,null,null,null];

var socket;

var items = {};
var images = {};
var users = [];
var actions = ["tuer", "donne"];
var world = "";
var turn = 0;

var map = [];
var topcorner = {x: 10, y: 10};
var view = {x: 10, y: 10};
var tile_width = 80;
var players_board_x = tile_width*7+50;

var x_range = 26;
var y_range = 26;

function GetURLParameter(param) {
  var pageURL = window.location.search.substring(1);
  var URLVariables = pageURL.split('&');
  for (var i = 0; i < URLVariables.length; i++) {
    var parameterName = URLVariables[i].split('=');
    if (parameterName[0] == param) {
      return parameterName[1];
    }
  }
}

function insertTextAtCursor(text) {
  var input = $("#input")[0];
  var input_text = input.value;
  var start_pos = input.selectionStart;
  var end_pos = input.selectionEnd;

  var before_str = input_text.substr(0, start_pos);
  var after_str  = input_text.substr(end_pos, input_text.length);

  input_text = before_str + text + after_str;
  input.value = input_text;
  input.oninput();
  return input_text;
}

function decorate(val_start, val_end) {
  var input = $("#input")[0];
  var input_text = input.value;
  var start_pos = input.selectionStart;
  var end_pos = input.selectionEnd;

  var before_str = input_text.substr(0, start_pos);
  var selected_str = input_text.substr(start_pos, end_pos-start_pos);
  var after_str  = input_text.substr(end_pos, input_text.length);

  input_text = before_str + val_start + selected_str + val_end + after_str;

  if (start_pos == end_pos) {
    var new_pos = start_pos + val_start.length;
  } else {
    var new_pos = start_pos + val_start.length + selected_str.length + val_end.length;
  }
  input.value = input_text;
  input.setSelectionRange(new_pos, new_pos);
  input.focus();
  input.oninput();
  return input_text;
}

function parse(value) {
  var coords_list = [];
  while (match = coordinates.exec(value)) {
    coords_list.push(match);
  }

  var actions_list = [];
  while (match = action.exec(value)) {
    actions_list.push(match);
  }

  var items_list = [];
  while (match = item.exec(value)) {
    items_list.push(match);
  }

  var player_list = [];
  while (match = player.exec(value)) {
    player_list.push(match);
  }

  var money_list = [];
  while (match = money.exec(value)) {
    money_list.push(match);
  }

  if (actions_list.length > 0) {
    if ((actions_list.length > 1) || (money_list.length > 1))  {
      return ["invalid", value];
    } else if (player_list.length == 1) {
      return ["exchange", value];
    }
  }
  return ["chat", value];
}

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
function pretty(message, id, timestamp, author) {
  var message = message;
  message = message.replace(coordinates, function(match, x, y, offset, string) {
    x_num = strToNum(x);
    if ((x_num < x_range) && (parseInt(y) < y_range) && (parseInt(y) > 0)) {
      return `<span class="coord">${x}${y}</span>`;
    } else {
      return `<span class="coord" style="color:red">${x}${y}</span>`;
    }
  });
  message = message.replace(player, function(match, name, offset, string) {
    if (users.includes(name.toLowerCase())) {
      return `<span class="player">${name}</span>`;
    } else {
      return `<span class="player" style="color:red">${name}</span>`;
    }
  });
  message = message.replace(action, function(match, name, offset, string) {
    if (actions.includes(name)) {
      return `<span class="action">${name}</span>`;
    } else {
      return `<span class="action" style="color:red">${name}</span>`;
    }
  });
  message = message.replace(money, function(match, name, offset, string) {
    return `<span class="money">${name}</span>`;
  });
  message = message.replace(item, function(match, name, offset, string) {
    if (items[name]) {
      return `<img class="items" src="${items[name].image}">`;
    } else {
      return `<img class="items" src="images/none.png">`;
    }
  });

  var cited = false;
  var regex = new RegExp(user, "i");
  if (message.search(regex) != -1) {
    cited = true;
  }
  if (id !== undefined) {
    date = new Date(timestamp);
    // message = '<span class="timestamp">' + date.toLocaleString() + '</span> <span class="author">' + author + ': </span>' + message;
    message = `<span class="author">${author}: </span>${message}`;
    message = `<img class="msgtype" src="images/${parse(message)[0]}.png" title="${date.toLocaleString()}">${message}`;
    if (cited) {
      message = `<span class="highlight">${message}</div>`;
    }
    message = `<div class="message" id="${id}" onclick="select_message(this)">${message}</div>`;
  }
  return message;
}

function select_message(elt) {
  $("#"+msgselected)[0].classList.remove("selected");
  msgselected = elt.id;
  elt.classList.add("selected");
}

function click_item(elt) {
  $("#input")[0].focus();
  insertTextAtCursor('{' + elt.id + '}');
}

window.onload = function() {
  socket = io.connect();
  socket.on('connect_error', function() {
    console.log('Connection failed');
  });
  socket.on('reconnect_failed', function() {
    console.log('Reconnection failed');
  });
  world = GetURLParameter('world');
  turn = GetURLParameter('turn');

  $('#admin_link').attr('href', `/admin?world=${world}&turn=${turn}`)

  var input = $("#input")[0];

  document.onclick = function(event) {
    if ((!document.getElementById("sidebar-wrapper").contains(event.target)) &&
        (!document.getElementById("footer").contains(event.target))) {
      document.getElementById(msgselected).classList.remove("selected");
      msgselected = "chatview";
    }
  }

  socket.on('server update', function(data) {
    user = data.username;
    $("#username").text(user);
    socket.emit('load_items', {world: world, turn: turn});
    socket.emit('load_users', {world: world, turn: turn});
    document.getElementById("chatview").innerHTML = "";
    newmsgs = [null,null,null,null,null,null,null,null,null,null];
    socket.emit('load_messages', {world: world, turn: turn});
    socket.emit('load_map', {world: world, turn: turn});
  });

  socket.on('load_items', function(data) {
    var options = "";
    for (let i = 0; i < data.length; i++) {
      items[data[i].name] = data[i];
      options += `<img class="items" src="${data[i].image}" id="${data[i].name}" onclick="click_item(this)" title="${data[i].name}">`;
    }
    $("#options").html(options);
  });

  socket.on('load_map', function(data) {
    map = data;
    
  });

  socket.on('load_users', function(data) {
    for (let i = 0; i < data.length; i++) {
      users.push(data[i].name.toLowerCase());
    }
    var out = "";
    for (let i = 0; i < data.length; i++) {
      if (data[i].truename == user) {
        out += `<tr class="info"><td>`;
      } else {
        out += "<tr><td>";
      }
      if (data[i].truename) {
        out += data[i].truename;
      }
      out += "</td><td>";
      if (data[i].victory_points) {
        out += data[i].victory_points;
      }
      out += "</td><td>";
      if (data[i].items) {
        for (let item in data[i].items) {
          out += item.number+'<img class="items" src="'+url_check(item.item.image)+'" title="'+item.item.name+'"><br>';
        }
      }
      out += "</td></tr>";
    }
    $('#users').html(out);
  });

  document.getElementById("coord").onclick = function() { decorate("[", "]"); }
  document.getElementById("action").onclick = function() { decorate("*", "*"); }
  document.getElementById("player").onclick = function() { decorate("@", ""); }
  document.getElementById("money").onclick = function() { decorate("", "$"); }

  input.oninput = function() { $("#preview")[0].innerHTML = pretty(input.value); };

  // send the message
  var send_line = function() {
    socket.emit('message', {
      world: world,
      turn: turn,
      message: input.value,
      parent: msgselected
    });
    input.value = "";
    input.oninput();
  }

  socket.on('message', function(data) {
    if ((data.world == world) && (data.turn == turn)) {
      if (data.parent == null) {
        data.parent = "chatview";
      }
      var value = pretty(data.message, data.id, data.timestamp, data.author);
      var old = document.getElementById(data.parent).innerHTML;
      document.getElementById(data.parent).innerHTML = old + value;
      document.getElementById(data.id).scrollIntoView(true);
      newmsgs.push(data.id);
      for (let i = 0; i < 10; i++) {
        if (newmsgs[i]) {
          document.getElementById(newmsgs[i]).classList.remove("new-"+(10-i));
        }
        if (newmsgs[i+1]) {
          document.getElementById(newmsgs[i+1]).classList.add("new-"+(10-i));
        }
      }
      newmsgs.shift();
    }
  });

  function showInfo(info, type="info") {
    // $("#info").show();
    $("#info").html(`<div class="alert alert-${type}" role="alert">${info}</div>`);
    console.log(info);
    $("#info").delay(5000).hide(400, function() {
      clearInfo();
      $("#info").show();
    });
  }
  function clearInfo() {
    $("#info").empty();
  }

  $("#button").on("click", send_line);
  input.onkeypress = function(event) {
    if (event.keyCode == 13) {
      send_line();
      return false;
    }
  }
}
