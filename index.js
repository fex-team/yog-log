module.exports = (function () {

    function warning(s) {
        console.log('[WARN] ' + s + '\n')
    }

    function error(s) {
        console.log('[ERROR] ' + s + '\n');
    }

    function fatal(s) {
        console.log('[FATAL] ' + s + '\n');
    }

    function notice(s) {
        console.log('[NOTICE] ' + s + '\n');
    }

    return {
        warning: warning,
        error: error,
        fatal: error,
        notice: notice
    }
})();