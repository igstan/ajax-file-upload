/*
 * Copyright (c) 2008-2009, Ionut Gabriel Stan. All rights reserved.
 *
 * Redistribution and use in source and binary forms, with or without modification,
 * are permitted provided that the following conditions are met:
 *
 *    * Redistributions of source code must retain the above copyright notice,
 *      this list of conditions and the following disclaimer.
 *
 *    * Redistributions in binary form must reproduce the above copyright notice,
 *      this list of conditions and the following disclaimer in the documentation
 *      and/or other materials provided with the distribution.
 *
 * THIS SOFTWARE IS PROVIDED BY THE COPYRIGHT HOLDERS AND CONTRIBUTORS "AS IS" AND
 * ANY EXPRESS OR IMPLIED WARRANTIES, INCLUDING, BUT NOT LIMITED TO, THE IMPLIED
 * WARRANTIES OF MERCHANTABILITY AND FITNESS FOR A PARTICULAR PURPOSE ARE
 * DISCLAIMED. IN NO EVENT SHALL THE COPYRIGHT OWNER OR CONTRIBUTORS BE LIABLE FOR
 * ANY DIRECT, INDIRECT, INCIDENTAL, SPECIAL, EXEMPLARY, OR CONSEQUENTIAL DAMAGES
 * (INCLUDING, BUT NOT LIMITED TO, PROCUREMENT OF SUBSTITUTE GOODS OR SERVICES;
 * LOSS OF USE, DATA, OR PROFITS; OR BUSINESS INTERRUPTION) HOWEVER CAUSED AND ON
 * ANY THEORY OF LIABILITY, WHETHER IN CONTRACT, STRICT LIABILITY, OR TORT
 * (INCLUDING NEGLIGENCE OR OTHERWISE) ARISING IN ANY WAY OUT OF THE USE OF THIS
 * SOFTWARE, EVEN IF ADVISED OF THE POSSIBILITY OF SUCH DAMAGE.
 */


/**
 * @param DOMNode form
 */
var Uploader = function(form) {
    this.form = form;
};

/*
 * Define an exception for this package
 */
Uploader.InvalidField = function(message) {
    this.message = message;
    this.name    = "Uploader.InvalidField";
};
/*
 * Inherit the built-in Error object so that our error can output the file
 * and line where it was thrown. Also the stack-trace.
 */
Uploader.InvalidField.prototype = new Error;

Uploader.prototype = {
    headers : {},
    
    /**
     * @param  HTMLInputElement element
     * @param  Number index
     * @param  Array[HTMLInputElement]
     * @return Array
     */
    _buttonField : function(element, index, elements) {
        if (element.value) {
            return [{
                isFile   : false,
                name     : element.name,
                value    : element.value || "",
                fileName : null
            }];
        }
        
        throw new Uploader.InvalidField;
    },
    
    /**
     * @param  HTMLInputElement element
     * @param  Number index
     * @param  Array[HTMLInputElement]
     * @return Array
     */
    _inputField : function(element, index, elements) {
        var type = element.type.toUpperCase();

        switch (type) {
            case "CHECKBOX":
            case "RADIO":
                if (element.checked === true) {
                    return [{
                        isFile   : false,
                        name     : element.name,
                        value    : element.value,
                        fileName : null
                    }];
                }
                throw new Uploader.InvalidField;
            case "TEXT":
            case "SUBMIT":
            case "PASSWORD":
                return [{
                    isFile   : false,
                    name     : element.name,
                    value    : element.value,
                    fileName : null
                }];
            case "FILE":
                if (element.files && element.files.length > 0) {
                    var files = Array.prototype.slice.call(element.files, 0);

                    return files.map(function(file, index, allFiles) {
                        return {
                            isFile   : true,
                            name     : element.name,
                            value    : file.getAsBinary(),
                            fileName : file.fileName
                        };
                    });
                }
                throw new Uploader.InvalidField;
            default:
                throw new Uploader.InvalidField;
        }
    },
    
    /**
     * @param  HTMLSelectElement element
     * @param  Number index
     * @param  Array[HTMLInputElement]
     * @return Array
     */
    _selectField : function(element, index, elements) {
        var fields = [];
        
        if (element.multiple === true) {
            var options = element.getElementsByTagName("option");
            options = Array.prototype.slice.call(element.options, 0);
            
            options.forEach(function(option, index, all) {
                if (option.selected && option.disabled !== true) {
                    fields.push({
                        isFile   : false,
                        name     : element.name,
                        value    : option.value,
                        fileName : null
                    });
                }
            });
        } else {
            fields.push({
                isFile   : false,
                name     : element.name,
                value    : element.value,
                fileName : null
            });
        }
        
        return fields;
    },

    /**
     * @param element HTMLElement
     * @return Boolean
     */
    _filter : function(element) {
        return element.nodeName.toUpperCase() !== "fieldset"
               &&
               element.disabled !== true;
    },
    
    /**
     * @return Array
     */
    get elements() {
        var fields = [];

        // Transform an HTMLCollection into an Array, so that we can use
        // functional style array methods
        var elements = Array.prototype.slice.call(this.form.elements, 0);

        // keep only the elements that we're interested in
        elements.filter(this._filter, this)
                // Process form values for each of the elements it has
                .forEach(function(element, index, elements) {
                    var type   = element.nodeName.toLowerCase();
                    var method = "_" + type + "Field";

                    if (type !== "fieldset") {
                        try {
                            fields = fields.concat(this[method](element, index, elements));
                        } catch (e if e instanceof Uploader.InvalidField) {}
                    }
                }, this);

        return fields;
    },

    /**
     * @return String
     */
    generateBoundary : function() {
        return "AJAX-----------------------" + (new Date).getTime();
    },

    /**
     * @param  Array elements
     * @param  String boundary
     * @return String
     */
    buildMessage : function(elements, boundary) {
        var CRLF  = "\r\n";
        var parts = [];

        elements.forEach(function(element, index, all) {
            var part  = "";
            
            if (element.isFile) {
                /*
                 * Content-Disposition header contains name of the field used
                 * to upload the file and also the name of the file as it was
                 * on the user's computer.
                 */
                part += 'Content-Disposition: form-data; ';
                part += 'name="' + element.name + '"; ';
                part += 'filename="'+ element.fileName + '"' + CRLF;

                /*
                 * Content-Type header contains the mime-type of the file to
                 * send. Although we could build a map of mime-types that match
                 * certain file extensions, we'll take the easy approach and
                 * send a general binary header: application/octet-stream.
                 */
                part += "Content-Type: application/octet-stream" + CRLF + CRLF;

                /*
                 * File contents read as binary data, obviously
                 */
                part += element.value + CRLF;
            } else {
                /*
                 * In case of non-files fields, Content-Disposition contains
                 * only the name of the field holding the data.
                 */
                part += 'Content-Disposition: form-data; ';
                part += 'name="' + element.name + '"' + CRLF + CRLF;

                /*
                 * Field value
                 */
                part += element.value + CRLF;
            }

            parts.push(part);
        });

        var request = "--" + boundary + CRLF;
            request+= parts.join("--" + boundary + CRLF);
            request+= "--" + boundary + "--" + CRLF;

        return request;
    },

    /**
     * @return null
     */
    send : function() {
        var xhr = new XMLHttpRequest;

        xhr.open("POST", this.form.action, true);
        xhr.onreadystatechange = function() {
            if (xhr.readyState === 4) {
                alert(xhr.responseText);
            }
        };
        
        var boundary    = this.generateBoundary();
        var contentType = "multipart/form-data; boundary=" + boundary;
        xhr.setRequestHeader("Content-Type", contentType);

        for (var header in this.headers) {
            xhr.setRequestHeader(header, headers[header]);
        }

        // finally send the request as binary data
        xhr.sendAsBinary(this.buildMessage(this.elements, boundary));
    }
};
