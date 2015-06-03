function getDocumentLocation(){
    if (!process.browser){throw new Error('getDocumentLocation is a client-only function')}
    return window.document.location.pathname + window.document.location.search + window.document.location.hash;
}
module.exports = getDocumentLocation;