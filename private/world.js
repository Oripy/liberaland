window.onload = function() {
  socket = io.connect();
  socket.on('connect_error', function() {
    console.log('Connection failed');
  });
  socket.on('reconnect_failed', function() {
    console.log('Reconnection failed');
  });

  socket.on('load_worlds', function(loaded_world) {
    var out = '';
    var worlds = loaded_world.worlds;
    for (let i = 0; i < worlds.length; i++) {
      out += `<tr onclick="loadWorld(this)" id="${worlds[i]._id}" turn="${worlds[i].last_turn}"><td>${worlds[i].name}</td><td>${worlds[i].last_turn}</td></tr>`;
    }
    out += '<tr class="no-hover"><td><input class="form-control" type="text" id="world_name"></td><td><button class="btn btn-primary" type="button" id="new_world" onclick="newWorld()">Nouveau</button></td></tr>'
    $('#worlds').html(out);
  });

  loadWorld = function(world) {
    window.location.href = `/game?world=${world.id}&turn=${world.getAttribute('turn')}`;
  }

  newWorld = function() {
    if ($('#world_name').val() != "") {
      // socket.emit('load_world', {new: true, name: $('#world_name').val()});
      $.post("/game", {name: $('#world_name').val()}, function(data, status) {
        window.location.href = '/game';
      });
    }
  }

  socket.on('load_world', function(data) {
    console.log(data);
  });

  socket.on('server update', function() {
    socket.emit('load_worlds');
  });
}
