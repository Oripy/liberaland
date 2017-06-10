function showTile(mapchunk, topcorner) {
  stroke(0);
  var local = {};
  local.x = mapchunk.x - topcorner.x;
  local.y = mapchunk.y - topcorner.y;
  if ((local.x >= 0) && (local.x < view.x) && (local.y >= 0) && (local.y < view.y)) {
    rect(local.x*tile_width, local.y*tile_width, tile_width, tile_width);
    let counter = 0;
    for (let i = 0; i < mapchunk.items.length; i++) {
      if (mapchunk.items[i].number > 0) {
        image(mapchunk.items[i].item.image, local.x + counter * 20, local.y + 10, 20, 20);
        noStroke();
        fill(0);
        text(mapchunk.items[i].number, local.x + counter * 20, local.y);
        counter++;
      }
    }
  }
}

function showPlayer(player, offset) {
  text(player.truename, players_board_x, 20 + offset);
  let counter = 0;
  for (let i = 0; i < player.items.length; i++) {
    if (player.items[i] > 0) {
      image(player.items[i].item.image, players_board_x + counter * 20, 20 + offset + 40, 20, 20);
      noStroke();
      fill(0);
      text(player.items[i], players_board_x + counter * 20, 20 + offset + 20);
      counter++;
    }
  }
}
