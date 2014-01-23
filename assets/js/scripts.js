$(document).ready(function() {
  $('a.menu').click(function() {
    $('.site-header nav').slideToggle(100);
    return false;
  });

  $(window).resize(function(){
    var w = $(window).width();
    var menu = $('.site-header nav');
    if(w > 680 && menu.is(':hidden')) {
      menu.removeAttr('style');
    }
  });


  $('article.post iframe').wrap('<div class="video-container" />');

});

$(function() {
  $("#logo a").click(function(e) {
    e.preventDefault();
    $("body,html").animate({scrollTop: 0});
  });

  $("article.post").waypoint(function(direction) {
    if (direction === "down") {
      $("#logo").css({opacity: 0}).show().animate({opacity: 1});
    } else if (direction === "up" ) {
      $("#logo").animate({opacity: 0}, function() {
        $(this).hide();
      });
    }
  });
});

$(function(){
  $('<img>').attr('src',function(){
      var imgUrl = $('div.featured-image').css('background-image');
      if (!imgUrl) {
        return;
      }
      imgUrl = imgUrl.substring(4, imgUrl.length-1);
      return imgUrl;
  }).load(function(){
    $('img.loading').fadeOut(500);
  });
});

$(function(){
    $('.post-list li').each(function(i){
        var t = $(this);
        setTimeout(function(){ t.addClass('slider'); }, (i+1) * 330);
    });
});
