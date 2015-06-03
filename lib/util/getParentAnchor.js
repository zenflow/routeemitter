var isAnchor = function(el){return (typeof el=='object') && (el.tagName.toLowerCase() == 'a')};
var getParentAnchor = function(element, deep){
    if (!process.browser){throw new Error('getParentAnchor is a client-only function')}
    if (typeof deep!='number'){deep = 8;}
    if (isAnchor(element)){return element;}
    return (deep > 0) && element.parentElement && getParentAnchor(element.parentElement, deep - 1);
};
module.exports = getParentAnchor;