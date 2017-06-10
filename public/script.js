var coordinates = /\[([a-zA-Z]+)([0-9]+)\]/g;
var item = /\{([\w]+)\}/g;
var action = /\*([\w]+)\*/g;
var player = /@([\w]+)/g;
var money = /([0-9]+)\$/g;
var user = null;
var msgselected = "chat";
var newmsgs = [null,null,null,null,null,null,null,null,null,null];

var items = {};
var users = [];
var actions = ["tuer", "donne"];

var x_range = 26;
var y_range = 26;

function insertTextAtCursor(text) {
  var input = document.getElementById("input");
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
  var input = document.getElementById("input");
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

function pretty(message, id, timestamp, author) {
  var message = message;
  message = message.replace(coordinates, function(match, x, y, offset, string) {
    x.toUpperCase();
    var x_num = 0;
    for (var i = 0; i < x.length; i++) {
      x_num += (x[i].charCodeAt() - 64)*Math.pow(26, x.length-i-1);
    }
    if ((x_num < x_range) && (parseInt(y) < y_range) && (parseInt(y) > 0)) {
      return '<span class="coord">'+x+y+'</span>';
    } else {
      return '<span class="coord" style="color:red">'+x+y+'</span>';
    }
  });
  message = message.replace(player, function(match, name, offset, string) {
    if (users.includes(name.toLowerCase())) {
      return '<span class="player">'+name+'</span>';
    } else {
      return '<span class="player" style="color:red">'+name+'</span>';
    }
  });
  message = message.replace(action, function(match, name, offset, string) {
    if (actions.includes(name)) {
      return '<span class="action">'+name+'</span>';
    } else {
      return '<span class="action" style="color:red">'+name+'</span>';
    }
  });
  message = message.replace(money, function(match, name, offset, string) {
    return '<span class="money">'+name+'</span>';
  });
  message = message.replace(item, function(match, name, offset, string) {
    if (items[name]) {
      return '<img class="items" src="'+items[name].image+'">';
    } else {
      return '<img class="items" src="images/none.png">';
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
    message = '<span class="author">' + author + ': </span>' + message;
    message = '<img class="msgtype" src="images/'+parse(message)[0]+'.png" title="'+date.toLocaleString()+'"> ' + message;
    if (cited) {
      message = '<span class="highlight">' + message + '</div>';
    }
    message = '<div class="message" id="'+id+'" onclick="select_message(this)">' + message + '</div>';
  }
  return message;
}

function select_message(elt) {
  document.getElementById(msgselected).classList.remove("selected");
  msgselected = elt.id;
  elt.classList.add("selected");
}

function click_item(elt) {
  document.getElementById("input").focus();
  insertTextAtCursor('{' + elt.id + '}');
}

window.onload = function() {
  var socket = io.connect();
  
  var input = document.getElementById("input");
  
  document.onclick = function(event) {
    if (!document.getElementById("chatarea").contains(event.target)) {
      document.getElementById(msgselected).classList.remove("selected");
      msgselected = "chat";
    }
  }
  
  socket.emit('init', {});
  
  socket.on('init', function(data) {
    user = data.username;
    for (let i = 0; i < data.users.length; i++) {
      users.push(data.users[i].name.toLowerCase());
    }
    var options = "";
    for (let i = 0; i < data.items.length; i++) {
      items[data.items[i].name] = data.items[i];
      options += '<img class="items" src="'+data.items[i].image+'" id="'+data.items[i].name+'" onclick="click_item(this)">';
    }
    document.getElementById("options").innerHTML = options;
  });

  document.getElementById("coord").onclick = function() { decorate("[", "]"); }
  document.getElementById("action").onclick = function() { decorate("*", "*"); }
  document.getElementById("player").onclick = function() { decorate("@", ""); }
  document.getElementById("money").onclick = function() { decorate("", "$"); }

  input.oninput = function() { document.getElementById("preview").innerHTML = pretty(input.value); }

  // send the message
  var send_line = function() {
    socket.emit('message', {
      message: input.value,
      parent: msgselected
    });
  }

  socket.on('message', function(data) {
    if (data.parent == null) {
      data.parent = "chat";
    }
    var value = pretty(data.message, data.id, data.timestamp, data.author);
    var old = document.getElementById(data.parent).innerHTML;
    document.getElementById(data.parent).innerHTML = old + value;
    input.value = "";
    input.oninput();
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
  });

  document.getElementById("button").onclick = send_line;
  input.onkeypress = function(event) {
    if (event.keyCode == 13) {
      send_line();
      return false;
    }
  }
}
