$(document).on('ready', function(){
    $('.github-tab').click(function(){
        SaltGithub.getRepoList(1, 30);
        listRepositories();
    });

    $('.import-framework').click(function(){
        Import.fromAsn();
    });

    /* Framework Updater */
    UpdateFramework.init();
    /**********/
});

var SaltGithub = (function(){

    function getRepoList(page, perPage) {
        if ($('.js-github-list').length > 0) {
            $.get('/user/github/repos', { page: page, perPage: perPage }, function(data){
                $('#repos').html('');

                $.each(data.data, function(i, e){
                    $(".js-github-list .js-github-message-loading").hide();
                    $(".js-github-list #repos").append('<li class="list-group-item item" data-owner="'+e.owner.login+'" data-repo="'
                                                       +e.name+'" data-sha="" data-path=""><span class="glyphicon glyphicon-folder-close" aria-hidden="true"></span> '+e.name+'</li>');
                    $('#repos').removeClass('hidden');
                });

                paginate(data.totalPages);
                itemListener('item', false);
            })
            .fail(function(){
                $(".js-github-list .js-github-message-loading").hide();
                $(".js-github-list .js-github-message-error").show();
            });
        }
    }

    function getFiles(evt, isFile) {
        var name = $(evt.target).attr('data-fname'),
            hasSubFolder = false;

        $.ajax({
            url: '/user/github/files',
            data: {
                owner: $(evt.target).attr('data-owner'),
                repo: $(evt.target).attr('data-repo'),
                sha: $(evt.target).attr('data-sha'),
                path: $(evt.target).attr('data-path')
            },
            type: 'get',
            dataType: 'json',
            success: function(response){
                if (isFile) {
                    var content = window.atob(response.data.content);
                    if (name.endsWith('.csv')) {
                        Import.csv(content);
                    } else if (name.endsWith('.json')) {
                        Import.json(content);
                    }
                } else {
                    $(".js-github-list #files").html('<ul></ul>');
                    response.data.forEach(function(item){
                        if (item.type === 'file') {
                            if (item.name.endsWith('.json') || item.name.endsWith('.csv') || item.name.endsWith('.md')) {

                                $(".js-github-list #files")
                                .append('<li class="list-group-item file-item" data-owner="'+$(evt.target)
                                        .attr('data-owner')+'" data-repo="'+$(evt.target).attr('data-repo')+'" data-sha="'+item.sha
                                        +'" data-fname="'+item.name+'"><span class="glyphicon glyphicon-file" aria-hidden="true"></span> '+item.name+'</li>');
                            }
                        } else if (item.type === 'dir') {
                            $(".js-github-list #files").append('<li class="list-group-item item" data-owner="'+$(evt.target).attr('data-owner')
                                                               +'" data-repo="'+$(evt.target).attr('data-repo')+'" data-sha="" data-path="'+item.path
                                                               +'"><span class="glyphicon glyphicon-folder-close" aria-hidden="true"></span> '+item.name+'</li>');

                            hasSubFolder = true;
                        }
                    });

                    $('#repos').addClass('hidden');
                    $('#files').removeClass('hidden');
                    $('#pagination').addClass('hidden');
                    $('.repositories-list').removeClass('hidden');
                    $('.panel-title').html($(evt.target).attr('data-repo') + '/');
                    itemListener('file-item', true);

                    if (hasSubFolder) {
                        itemListener('item', false);
                    }

                    if ($(evt.target).attr('data-path').length > 0) {
                        var path = $(evt.target).attr('data-path'), back = '';
                        var split = path.split('/');

                        for (var i = 0; i < split.length - 1; i++) {
                            back += split[i] + '/';
                        }

                        $('.panel-title').html($(evt.target).attr('data-repo') + '/' + $(evt.target).attr('data-path') + '/');

                        $('.back').attr('data-owner', $(evt.target).attr('data-owner'));
                        $('.back').attr('data-repo', $(evt.target).attr('data-repo'));
                        $('.back').attr('data-path', back);
                    }

                    if ($(evt.target).attr('data-repo') + '/' == $('.panel-title').html()) {
                        $('.back').addClass('hidden');
                    } else {
                        $('.back').removeClass('hidden');
                    }
                }
            }
        });
    }

    function paginate(pages) {
        $('#pagination').twbsPagination({
            totalPages: pages,
            visiblePages: 5,
            onPageClick: function(event, page){
                getRepoList(page, 30);
            }
        });
    }

    function itemListener(elementClass, isFile) {
        var $element = $('.' + elementClass);

        $element.click(function(evt){
            getFiles(evt, isFile);
        });
    }

    return {
        getRepoList: getRepoList,
        getFiles: getFiles
    };
})();

var UpdateFramework = (function(){
    var frameworkToAssociateSelector = '#js-framework-to-association-on-update',
        pathToUpdateFramework = "/app_dev.php/cfdoc/doc/" + getCurrentCfDocId() + "/update";

    function init(){
        $('body').on('click', '.btn.btn--updater', function(){
            SaltLocal.handleFile( $(this).data('update-action') );
        });
    }

    function getRequestParams(fileContent){
        fileData = Import.csv(fileContent, true);
        return {
            content: window.btoa(unescape(encodeURIComponent(fileContent))),
            cfItemKeys: fileData.cfItemKeys,
            frameworkToAssociate: $(frameworkToAssociateSelector).val(),
        }
    }

    function getCurrentCfDocId(){
        return $('#lsDocId').val();
    }

    function derivative(fileContent){
        $.post(pathToUpdateFramework + "/derivative", getRequestParams(fileContent), function(){
            // location.reload();
        });
    }

    function update(fileContent){
        $.post(pathToUpdateFramework, getRequestParams(fileContent), function(){
            // location.reload();
        });
    }

    return { init: init, derivative: derivative, update: update }
})();

var Import = (function() {

    var file = "";
    var cfItemKeys = {};

    function csvImporter(content, disableRequest) {
        file = content;

        var fields = CfItem.fields;
        var lines = file.split("\n");
        var columns = lines[0].split(",");
        var index = null, field = null, column = null;

        for (var i = 0; i < fields.length; i++) {
            field = fields[i];
            for (var j = 0; j < columns.length; j++) {
                column = columns[j];
                if (column.length > 0) {
                    if (Util.simplify(field) === Util.simplify(column)) {
                        cfItemKeys[field] = column;

                        index = fields.indexOf(field);
                        if (index >= 0) {
                            fields.splice(index, 1);
                        }

                        index = columns.indexOf(column);
                        if (index >= 0) {
                            columns.splice(index, 1);
                        }

                        i--;
                        break;
                    }
                }
            }
        }
        if (disableRequest){
            return { cfItemKeys: cfItemKeys, fields: fields };
        }

        if (fields.length > 0) {
            fields.forEach(function(field) {
                CfItem.missingField(field);
            });

            $('#import-div').addClass('hidden');
            $('#errors').removeClass('hidden');
        } else {
            $('#import-div').addClass('hidden');
            $('.file-loading .row .col-md-12').html(Util.spinner('Loading file'));
            $('.file-loading').removeClass('hidden');
        }

        index = fields.indexOf('humanCodingScheme');

        if (index < 0) {
            $('.file-loading').addClass('hidden');
            sendData();
        }
    }

    function jsonImporter(file) {
        var json = JSON.parse(file);
        var keys = Object.keys(json);
        var subKey = [];

        keys.forEach(function(subJson){
            subKey = Object.keys(subJson);
        });
    }

    function sendData() {
        var dataRequest = {
            content: window.btoa(unescape(encodeURIComponent(file))),
            cfItemKeys: cfItemKeys,
            lsDocId: $('#lsDocId').val(),
            frameworkToAssociate: $('#js-framework-to-association').val(),
            missingFieldsLog: CfItem.getErrorsLog()
        };

        $.ajax({
            url: '/cf/github/import',
            type: 'post',
            data: dataRequest,
            success: function(response){
                location.reload();
            }
        });
    }

    function asnStructure(content) {
        $.ajax({
            url: '/cf/asn/import',
            type: 'post',
            data: {
                fileUrl: $('#asn-url').val()
            },
            success: function(response){
                location.reload();
            },
            error: function(){
                $('.asn-error-msg').html('<strong>Error!</strong> Something went wrong.').removeClass('hidden');
            }
        });
    }

    function caseImporter(file) {
        $('.tab-content').addClass('hidden');
        $('.file-loading .row .col-md-12').html(Util.spinner('Loading file'));
        $('.file-loading').removeClass('hidden');
        $('.case-error-msg').addClass('hidden');

        $.ajax({
            url: '/salt/case/import',
            type: 'post',
            data: {
                fileContent: window.btoa(unescape(file))
            },
            success: function(response) {
                location.reload();
            },
            error: function(){
                $('.tab-content').removeClass('hidden');
                $('.case-error-msg').html('Error while importing the file');
                $('.case-error-msg').removeClass('hidden');
                $('.file-loading').addClass('hidden');
            }
        });
    }

    return {
        csv: csvImporter,
        json: jsonImporter,
        send: sendData,
        fromAsn: asnStructure,
        case: caseImporter
    };
})();

var SaltLocal = (function(){

    function handleFileSelect(fileType) {
        var files;
        var json = '', f;

        if (fileType === 'update' || fileType === 'derivative'){
            files = document.getElementById('file-for-update').files;
        } else {
            files = document.getElementById('file-url').files;
        }

        if (window.File && window.FileReader && window.FileList && window.Blob) {
            for (var i=0; f = files[i]; i++) {
                console.log('name:', escape(f.name), '- type:', f.type || 'n/a', '- size:', f.size,
                            'bytes', '- lastModified:', f.lastModified ? f.lastModifiedDate.toLocaleDateString() : 'n/a');

                var reader = new FileReader();
                if (f.type === 'text/csv' || f.type === 'application/json') {
                    reader.onload = (function(theFile) {
                        return function(e) {
                            var file = e.target.result;
                            if (fileType === 'local') {
                                Import.csv(file);
                            } else if (fileType === 'case') {
                                Import.case(file);
                            } else if (fileType === 'derivative') {
                                UpdateFramework.derivative(file);
                            } else if (fileType === 'update') {
                                UpdateFramework.update(file);
                            }
                        };
                    })(f);

                    reader.readAsText(f);
                } else {
                    console.error('file type not allowed - ' + f.type);
                }
            }
        } else {
            console.error('The FILE APIs are not fully supported in this broswer');
        }
    }

    return {
        handleFile: handleFileSelect
    };
})();

var CfItem = (function(){

    var missingFieldsErrorMessages = [];

    var fields = [
        'identifier',
        'fullStatement',
        'humanCodingScheme',
        'abbreviatedStatement',
        'conceptKeywords',
        'notes',
        'language',
        'educationLevel',
        'cfItemType',
        'license',

        'cfAssociationGroupIdentifier',
        'isChildOf',
        'isPartOf',
        'replacedBy',
        'exemplar',
        'precedes',
        'isPeerOf',
        'hasSkillLevel',
        'isRelatedTo'
    ];

    function generateDropdowns(arrData, type){
        var mandatoryClass = "";
        var panelType = "default";
        arrData.chunk(2).forEach(function(dropdownGrouped){
        $('.dropdowns.'+type).append('<div class="row"></div>');
        dropdownGrouped.forEach(function(dropdown){
                if( dropdown[1] === 'M' ){ mandatoryClass = "mandatory-class"; panelType = "primary" }
                $('.dropdowns.'+type+' .row').last().append('<div class="col-xs-6"><div class="panel panel-'+ panelType +'"><div class="panel-body '+ mandatoryClass +'"></div></div></div>');
                $('.dropdowns.'+type+' .row .panel-body').last().append('<div class="col-xs-6"><div class="form-group"><label>'+dropdown[0].titleize()+'</label><select name="'+dropdown[0]+'" class="form-control select"><option>Choose one option</option></select></div></div>');
                $('.dropdowns.'+type+' .row .panel-body').last().append('<div class="col-xs-6"><div class="form-group"><label>Enter default value if needed</label><input name="'+dropdown[0]+'_default_value" type="text" class="form-control"/></div></div>');
                mandatoryClass = "";panelType = "default";
            });
        });
    }

    function validDropdowns(formMatchedSelector) {
        var missingRequiredFiles = false;

        $(formMatchedSelector).find("select").each(function(i,e) {
            if ($(e).val().length < 1) {
                 missingRequiredFiles = true;
            }
        });

        if (missingRequiredFiles) {
            $(".js-alert-missing-fields").removeClass("hidden");
        } else {
            $(".js-alert-missing-fields").addClass("hidden");
        }

        return !missingRequiredFiles;
    }

    function missingField(field) {
        var alert = '<div class="alert alert-warning js-alert-missing-fields" role="alert">';
        alert += '<a href="#" class="close" data-dismiss="alert" aria-label="close">x</a>';
        alert += '<div class="js-error-message-missing-field">';
        alert += '<strong>Missing field "'+Util.titleize(field)+'"</strong>, if you did not list a column '+field+' in your CSV ignore this message! ';
        alert += 'if you meant to, please take a look at the import template and try again!';
        alert += '</div>';
        alert += '</div>';

        missingFieldsErrorMessages.push($(alert).find(".js-error-message-missing-field").text());
        console.info($(alert).find(".js-error-message-missing-field").text());

        $('.missing-fields').append(alert);
    }

    function getErrorsLog(){
        return missingFieldsErrorMessages;
    }

    return {
        fields: fields,
        validDropdowns: validDropdowns,
        missingField: missingField,
        getErrorsLog: getErrorsLog
    };
})();

var SanitizeData = (function(){

    function matchedFields(formSelector){
        var sanitizedData = {},
            tempData = {},
            formData = $(formSelector).serializeArray();

        formData.forEach(function(e){ tempData[e.name] = e.value; });

        return tempData;
    }

    return {
        matchedFields: matchedFields
    };
})();

var Util = (function(){

    function simplify(string){
        return string.match(/[a-zA-Z]*/g).join("").toLowerCase();
    }

    function capitalize(string){
        return string.charAt(0).toUpperCase() + string.slice(1);
    }

    function titleize(string){
        return capitalize(string.replace(/([A-Z]+)/g, " $1").replace(/([A-Z][a-z])/g, " $1"));
    }

    function chunk(array, n){
        if ( !this.length ) {
            return [];
        }
        return [ this.slice( 0, n ) ].concat( this.slice(n).chunk(n) );
    }

    function spinnerHtml(msg) {
        return '<div class="spinnerOuter"><span class="glyphicon glyphicon-cog spinning spinnerCog"></span><span class="spinnerText">' + msg + '</span></div>';
    }

    return {
        simplify: simplify,
        titleize: titleize,
        spinner: spinnerHtml
    };
})();

function listRepositories(){
    $('#files').addClass('hidden');
    $('#repos').removeClass('hidden');
    $('#pagination').removeClass('hidden');
    $('.repositories-list').addClass('hidden');
    $('.panel-title').html('Repositories list');
    $('#back').html('');
}
