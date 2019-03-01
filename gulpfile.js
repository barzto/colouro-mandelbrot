const
    gulp = require('gulp'),
    concat = require('gulp-concat'),
    uglify = require('gulp-uglify'),
    download = require('gulp-download-stream'),
    browserSync = require('browser-sync').create();

gulp.task('deps:colouro', function (done) {
    gulp
        .src([
            './node_modules/colouro-sdk/dist/colouro-reskin.js',
        ])
        .pipe(gulp.dest('deps'));
    done();
});

gulp.task('deps:twgl', function (done){
    download('https://github.com/greggman/twgl.js/raw/master/dist/4.x/twgl-full.min.js')
        .pipe(gulp.dest('deps'));
    done();
});

gulp.task('deps', gulp.parallel('deps:colouro', 'deps:twgl'));

gulp.task('browserSync', function () {
    browserSync.init({ server: { baseDir: './'}});
});

gulp.task('default', gulp.parallel('deps'));


gulp.task('watch', function() {
    gulp
        .watch([
            './*.html',
            './css/*.css',
            './src/*.js'
        ])
        .on('change', browserSync.reload);

});

gulp.task('dev', gulp.series('browserSync', function () {
    gulp.start('watch');
}));
