require(["splunkjs/mvc", "jquery"], function(mvc, $) {
    "use strict";

    var macros = [];

    function setStatus(message, isError) {
        $("#status-message").removeClass("error success")
            .addClass(isError ? "error" : "success").text(message);
    }

    function appId() {
        return $.trim($("#external-app-id").val()) || "search";
    }

    function existingMode() {
        return $("#macro-mode").val() === "existing";
    }

    function propertiesFromForm() {
        var properties = [];
        $(".property-row").each(function() {
            var $row = $(this);
            var name = $.trim($row.find(".property-name").val());
            if (name) {
                properties.push({
                    name: name,
                    type: $row.find(".property-type").val(),
                    description: $.trim($row.find(".property-description").val()),
                    choices: $.trim($row.find(".property-choices").val()),
                    required: $row.find(".property-required").is(":checked")
                });
            }
        });
        return properties;
    }

    function selectedMacro() {
        var name = $("#existing-macro").val();
        for (var i = 0; i < macros.length; i += 1) {
            if (macros[i].name === name) { return macros[i]; }
        }
        return null;
    }

    function currentMacroName() {
        if (existingMode()) { return $("#existing-macro").val() || ""; }
        var suffix = $.trim($("#macro-suffix").val());
        return suffix ? "dvd_" + suffix : "";
    }

    function updatePreview() {
        var properties = propertiesFromForm();
        var name = currentMacroName();
        if (!name || !properties.length) {
            $("#macro-call-preview").text("Add a property and choose a macro to preview the call.");
            return;
        }
        var args = properties.map(function(property) { return "$" + property.name + "$"; });
        $("#macro-call-preview").text(name + "(" + args.join(",") + ")");
    }

    function addProperty() {
        var $row = $("<div>", { "class": "property-row" });
        var $name = $("<input>", {
            type: "text", "class": "property-name", placeholder: "property_name",
            pattern: "[A-Za-z_][A-Za-z0-9_]*", required: "true"
        });
        var $type = $("<select>", { "class": "property-type" });
        ["string", "integer", "number", "boolean"].forEach(function(type) {
            $type.append($("<option>", { value: type, text: type }));
        });
        var $description = $("<input>", {
            type: "text", "class": "property-description", placeholder: "Description for the LLM"
        });
        var $choices = $("<input>", {
            type: "text", "class": "property-choices", placeholder: "Allowed values, comma-separated (optional)"
        });
        var $required = $("<input>", { type: "checkbox", "class": "property-required" });
        var $remove = $("<button>", { type: "button", "class": "remove-property", text: "Remove" });

        $row.append(
            $("<div>", { "class": "property-control" }).append($("<label>", { text: "Name" }), $name),
            $("<div>", { "class": "property-control" }).append($("<label>", { text: "Type" }), $type),
            $("<div>", { "class": "property-control" }).append($("<label>", { text: "Description" }), $description),
            $("<div>", { "class": "property-control" }).append($("<label>", { text: "Allowed values" }), $choices),
            $("label", { "class": "required-control" }).append($required, " Required"),
            $remove
        );
        $("#properties-list").append($row);
        updatePreview();
    }

    function parseChoice(value, type) {
        if (type === "integer") { return parseInt(value, 10); }
        if (type === "number") { return Number(value); }
        if (type === "boolean") { return value.toLowerCase() === "true"; }
        return value;
    }

    function buildSchema(properties) {
        var fields = {};
        var required = [];
        properties.forEach(function(property) {
            var field = { type: property.type, description: property.description || property.name };
            if (property.choices) {
                var choices = property.choices.split(",").map(function(value) {
                    return $.trim(value);
                }).filter(function(value) { return value.length > 0; });
                if (choices.length) {
                    field.enum = choices.map(function(value) { return parseChoice(value, property.type); });
                }
            }
            fields[property.name] = field;
            if (property.required) { required.push(property.name); }
        });
        var schema = { type: "object", properties: fields };
        if (required.length) { schema.required = required; }
        return schema;
    }

    function responseData(response) {
        if (!response || response.data === undefined || response.data === null) { return {}; }
        return typeof response.data === "string" ? JSON.parse(response.data) : response.data;
    }

    function macroArgs(entry) {
        var args = entry.content && entry.content.args;
        if (Array.isArray(args)) { return args; }
        if (typeof args === "string") {
            return args.split(",").map(function(arg) { return $.trim(arg); }).filter(function(arg) { return arg.length > 0; });
        }
        return [];
    }

    function macroNameFromEntry(entry) {
        return entry.name.replace(/\s*\([^)]*\)$/, "");
    }

    function requestError(error, response) {
        if (error && error.message) { return error.message; }
        if (response && response.data) {
            try {
                var data = responseData(response);
                if (data.messages && data.messages.length) { return data.messages[0].text; }
                return typeof response.data === "string" ? response.data : JSON.stringify(response.data);
            } catch (ignore) {
                return String(response.data);
            }
        }
        return "Check Splunk permissions and the endpoint response.";
    }

    function loadMacros() {
        var $select = $("#existing-macro");
        $select.empty().append($("<option>", { value: "", text: "Loading macros..." }));
        var path = "/servicesNS/nobody/" + encodeURIComponent(appId()) + "/data/macros";

        mvc.createService().request(path, "GET", { output_mode: "json", count: 0 }, null, null, null,
            function(error, response) {
                if (error) {
                    macros = [];
                    $select.empty().append($("<option>", { value: "", text: "Unable to load macros" }));
                    setStatus("Could not load macros from app '" + appId() + "': " + requestError(error, response), true);
                    return;
                }
                try {
                    var entries = responseData(response).entry || [];
                    macros = entries.filter(function(entry) {
                        return entry && typeof entry.name === "string" && macroNameFromEntry(entry).indexOf("dvd_") === 0;
                    }).map(function(entry) {
                        return {
                            name: macroNameFromEntry(entry),
                            args: macroArgs(entry),
                            definition: entry.content && entry.content.definition ? entry.content.definition : ""
                        };
                    });
                    $select.empty().append($("<option>", {
                        value: "", text: macros.length ? "Select a prebuilt dvd_ macro" : "No dvd_ macros found in this app"
                    }));
                    macros.forEach(function(macro) {
                        $select.append($("<option>", { value: macro.name, text: macro.name }));
                    });
                    if (!macros.length) {
                        setStatus("No prebuilt dvd_ macros were returned for app '" + appId() + "'. Check app selection and permissions.", true);
                    }
                    updatePreview();
                } catch (parseError) {
                    macros = [];
                    $select.empty().append($("<option>", { value: "", text: "Could not read macros" }));
                    setStatus("Splunk returned an unreadable macro list: " + parseError.message, true);
                }
            }
        );
    }

    function syncMacroMode() {
        var existing = existingMode();
        $(".macro-create-only").toggleClass("hidden", existing);
        $(".macro-existing-only").toggleClass("hidden", !existing);
        $("#macro-suffix").prop("required", !existing);
        $("#existing-macro").prop("required", existing);
        $("#macro-definition").prop("readonly", existing);

        var macro = selectedMacro();
        if (existing && macro) {
            $("#macro-definition").val(macro.definition);
            $("#macro-definition-help").text("Prebuilt macro definition is read-only. Property names must match its arguments and variables.");
        } else if (existing) {
            $("#macro-definition").val("");
            $("#macro-definition-help").text("Select a prebuilt macro to inspect its definition and arguments.");
        } else {
            $("#macro-definition-help").html("Every property must have a matching <code>$property_name$</code> variable.");
        }
        updatePreview();
    }

    function validate(properties, definition, macro) {
        if (!properties.length) { return "Add at least one property before creating the tool."; }
        var seen = {};
        for (var i = 0; i < properties.length; i += 1) {
            var name = properties[i].name;
            if (!/^[A-Za-z_][A-Za-z0-9_]*$/.test(name)) {
                return "Property names must start with a letter or underscore and contain only letters, numbers, or underscores.";
            }
            if (seen[name]) { return "Property names must be unique."; }
            seen[name] = true;
            if (definition.indexOf("$" + name + "$") === -1) {
                return "Macro definition must include $" + name + "$ for every property.";
            }
        }
        if (!/^dvd_[A-Za-z0-9_]+$/.test(currentMacroName())) { return "Macro name must start with dvd_ and use a valid suffix."; }
        if (!definition) { return "Macro definition is required."; }
        if (existingMode()) {
            if (!macro) { return "Select a prebuilt dvd_ macro before creating the tool."; }
            var macroProperties = macro.args.slice().sort();
            var formProperties = properties.map(function(property) { return property.name; }).sort();
            if (macroProperties.length !== formProperties.length || macroProperties.some(function(arg, index) { return arg !== formProperties[index]; })) {
                return "Macro parameters do not match these properties. Conform the properties to the macro or manually update the macro, then Reload.";
            }
        }
        if (!$.trim($("#tool-name").val()) || !$.trim($("#tool-title").val()) || !$.trim($("#tool-description").val())) {
            return "Tool name, title, and description are required.";
        }
        return "";
    }

    function createMacro(name, definition, properties, callback) {
        var path = "/servicesNS/nobody/" + encodeURIComponent(appId()) + "/configs/conf-macros";
        mvc.createService().request(path, "POST", { output_mode: "json" }, {
            name: name,
            definition: definition,
            args: properties.map(function(property) { return property.name; }).join(","),
            iseval: "0"
        }, null, null, callback);
    }

    function createTool(properties, name, callback) {
        var invocationArgs = properties.map(function(property) { return "$" + property.name + "$"; });
        var payload = {
            name: $.trim($("#tool-name").val()),
            title: $.trim($("#tool-title").val()),
            description: $.trim($("#tool-description").val()),
            inputSchema: buildSchema(properties),
            _meta: {
                external_app_id: appId(),
                execution: {
                    type: "spl",
                    template: name + "(" + invocationArgs.join(",") + ")",
                    row_limiter: true,
                    time_range: false
                },
                tags: ["mcp", "guided-query"],
                examples: []
            }
        };
        mvc.createService().request("/services/mcp_tools", "POST", null, null, JSON.stringify(payload), {
            "Content-Type": "application/json"
        }, callback);
    }

    $(function() {
        $("#add-property").on("click", addProperty);
        $("#properties-list").on("input change", ".property-row input, .property-row select", updatePreview);
        $("#properties-list").on("click", ".remove-property", function() {
            $(this).closest(".property-row").remove();
            updatePreview();
        });
        $("#macro-suffix").on("input", updatePreview);
        $("#macro-mode").on("change", syncMacroMode);
        $("#existing-macro").on("change", syncMacroMode);
        $("#reload-macros").on("click", loadMacros);
        $("#external-app-id").on("change", function() { if (existingMode()) { loadMacros(); } });

        $("#mcp-form").on("submit", function(event) {
            event.preventDefault();
            var $submit = $(".primary-btn");
            if ($submit.prop("disabled")) { return; }

            var properties = propertiesFromForm();
            var macro = selectedMacro();
            var definition = $.trim($("#macro-definition").val());
            var error = validate(properties, definition, macro);
            if (error) { setStatus(error, true); return; }

            var name = currentMacroName();
            $submit.prop("disabled", true);

            function finish(errorMessage) {
                $submit.prop("disabled", false);
                if (errorMessage) { setStatus(errorMessage, true); }
            }

            function postTool() {
                setStatus("Macro created. Creating MCP tool...", false);
                createTool(properties, name, function(toolError, response) {
                    if (toolError) {
                        finish("Macro was created, but MCP tool creation failed: " + requestError(toolError, response));
                        return;
                    }
                    $submit.prop("disabled", false);
                    setStatus("Macro and MCP tool created successfully: " + name, false);
                });
            }

            if (existingMode()) {
                setStatus("Creating MCP tool with prebuilt macro...", false);
                postTool();
                return;
            }

            setStatus("Creating search macro...", false);
            createMacro(name, definition, properties, function(macroError, response) {
                if (macroError) {
                    finish("Macro creation failed: " + requestError(macroError, response));
                    return;
                }
                postTool();
            });
        });

        $("#reset-btn").on("click", function() {
            $("#mcp-form")[0].reset();
            $("#properties-list").empty();
            $("#external-app-id").val("search");
            $("#macro-definition").val("");
            $("#status-message").removeClass("error success").text("");
            syncMacroMode();
            loadMacros();
        });

        syncMacroMode();
        loadMacros();
    });
});
