require(["splunkjs/mvc", "jquery"], function (mvc, $) {
    "use strict";

    var service = mvc.createService();
    var IDENTIFIER = /^[A-Za-z_][A-Za-z0-9_]*$/;
    var RESERVED_TOOL_ARGUMENTS = ["app", "workload_pool"];
    var macros = [];

    function val(selector) { return $.trim($(selector).val()); }
    function appId() { return val("#external-app-id") || "search"; }
    function isExisting() { return $("#macro-mode").val() === "existing"; }
    function toVar(name) { return "$" + name + "$"; }

    function setStatus(message, isError) {
        $("#status-message").removeClass("error success")
            .addClass(isError ? "error" : "success")
            .text(message);
    }

    function splitList(text) {
        return text.split(",").map(function (item) { return $.trim(item); }).filter(Boolean);
    }

    function errorText(error, response) {
        if (error && error.message) { return error.message; }
        var data = response && response.data;
        if (!data) { return "Check Splunk permissions and the endpoint response."; }
        try {
            var parsed = typeof data === "string" ? JSON.parse(data) : data;
            if (parsed.messages && parsed.messages.length) { return parsed.messages[0].text; }
        } catch (ignore) { /* Use the raw response below. */ }
        return typeof data === "string" ? data : JSON.stringify(data);
    }

    function request(path, method, query, post, body, headers) {
        var deferred = $.Deferred();
        service.request(path, method, query, post, body, headers, function (error, response) {
            if (error) { deferred.reject(errorText(error, response)); }
            else { deferred.resolve(response); }
        });
        return deferred.promise();
    }

    function readProperties() {
        return $("#properties-list .property-row").map(function () {
            var $row = $(this);
            return {
                name: $.trim($row.find(".property-name").val()),
                type: $row.find(".property-type").val(),
                description: $.trim($row.find(".property-description").val()),
                choices: $.trim($row.find(".property-choices").val()),
                required: true
            };
        }).get().filter(function (property) { return property.name; });
    }

    function currentMacroName() {
        if (isExisting()) { return $("#existing-macro").val() || ""; }
        var suffix = val("#macro-suffix");
        if (!suffix) { return ""; }
        return "dvd_" + suffix + "(" + readProperties().length + ")";
    }

    function selectedMacro() {
        var name = $("#existing-macro").val();
        return macros.filter(function (macro) { return macro.name === name; })[0] || null;
    }

    function callTemplate(name, properties) {
        return name + "(" + properties.map(function (property) { return toVar(property.name); }).join(",") + ")";
    }

    function updatePreview() {
        var properties = readProperties();
        var name = currentMacroName();
        $("#macro-call-preview").text(name && properties.length
            ? callTemplate(name, properties)
            : "Add a property and choose a macro to preview the call.");
    }

    function addProperty() {
        var $row = $("#property-template .property-row").clone().removeClass("property-template-row");
        $row.find(":input").prop("disabled", false);
        $("#properties-list").append($row);
        updatePreview();
    }

    function onRemoveProperty() {
        $(this).closest(".property-row").remove();
        updatePreview();
    }

    function syncMacroMode() {
        var existing = isExisting();
        var macro = selectedMacro();
        $(".macro-create-only").toggleClass("hidden", existing);
        $(".macro-existing-only").toggleClass("hidden", !existing);
        $("#macro-suffix").prop("required", !existing);
        $("#existing-macro").prop("required", existing);
        $("#macro-definition").prop("readonly", existing);

        if (!existing) {
            $("#macro-definition-help").html("Every added property must have a corresponding <code>$property_name$</code> variable in the macro definition.");
        } else if (macro) {
            $("#macro-definition").val(macro.definition);
            $("#macro-definition-help").text("Prebuilt macro definition is read-only. Property names must match its arguments and variables.");
        } else {
            $("#macro-definition").val("");
            $("#macro-definition-help").text("Select a prebuilt macro to inspect its definition and arguments.");
        }
        updatePreview();
    }

    function macroArgs(entry) {
        var args = entry.content && entry.content.args;
        if (Array.isArray(args)) { return args; }
        return typeof args === "string" ? splitList(args) : [];
    }

    function showMacroLoadError(selectText, statusText) {
        macros = [];
        $("#existing-macro").empty().append($("<option>", { value: "", text: selectText }));
        setStatus(statusText, true);
    }

    function loadMacros() {
        var $select = $("#existing-macro").empty()
            .append($("<option>", { value: "", text: "Loading Macros..." }));
        var path = "/servicesNS/nobody/" + encodeURIComponent(appId()) + "/data/macros";

        request(path, "GET", { output_mode: "json", count: 0 }).done(function (response) {
            try {
                var data = typeof response.data === "string" ? JSON.parse(response.data) : response.data;
                macros = ((data && data.entry) || []).map(function (entry) {
                    return {
                        name: entry.name.replace(/\\s*\\([^)]*\\)$/, ""),
                        args: macroArgs(entry),
                        definition: (entry.content && entry.content.definition) || ""
                    };
                }).filter(function (macro) { return macro.name.indexOf("dvd_") === 0; });
            } catch (error) {
                showMacroLoadError("Unable to Load Macros", "Splunk returned an unreadable macro list: " + error.message);
                return;
            }
            $select.empty().append($("<option>", {
                value: "", text: macros.length ? "Select a Prebuilt dvd_ Macro" : "No dvd_ Macros Found in This App"
            }));
            macros.forEach(function (macro) { $select.append($("<option>", { value: macro.name, text: macro.name })); });

            updatePreview();
        }).fail(function (message) {
            showMacroLoadError("Unable to Load Macros", "Could not load macros from app '" + appId() + "': " + message);
        });
    }

    function validate(properties, definition, macro) {
        if (!properties.length) { return "Add at least one property before creating the tool."; }
        var names = properties.map(function (property) { return property.name; });
        if (names.some(function (name) { return !IDENTIFIER.test(name); })) {
            return "Property names must start with a letter or underscore and contain only letters, numbers, or underscores.";
        }
        if (names.some(function (name, index) { return names.indexOf(name) !== index; })) { return "Property names must be unique."; }
        if (names.some(function (name) { return RESERVED_TOOL_ARGUMENTS.indexOf(name) !== -1; })) {
            return "Property names 'app' and 'workload_pool' are reserved tool arguments.";
        }
        if (!/^dvd_[A-Za-z0-9_]+$/.test(currentMacroName())) { return "Macro name must start with dvd_ and use a valid suffix."; }
        if (!definition) { return "Macro definition is required."; }
        var missing = names.filter(function (name) { return definition.indexOf(toVar(name)) === -1; })[0];
        if (missing) { return "Macro definition must include " + toVar(missing) + " for every property."; }
        if (isExisting()) {
            if (!macro) { return "Select a prebuilt dvd_ macro before creating the tool."; }
            if (macro.args.slice().sort().join(",") !== names.slice().sort().join(",")) {
                return "Macro parameters do not match these properties. Conform the properties to the macro or manually update the macro, then Reload.";
            }
        }
        if (!val("#tool-name") || !val("#tool-title") || !val("#tool-description")) {
            return "Tool name, title, and description are required.";
        }
        return "";
    }

    function parseChoice(value, type) {
        if (type === "integer") { return parseInt(value, 10); }
        if (type === "number") { return Number(value); }
        if (type === "boolean") { return value.toLowerCase() === "true"; }
        return value;
    }

    function buildSchema(properties) {
        var app = appId();
        var schema = { type: "object", properties: {
            app: {
                type: "string",
                description: "Splunk app context to run the SPL query in (e.g., 'search', 'enterprise_security'). Set this when the user specifies an app — omitting it means app-scoped field extractions and lookups will not be applied.",
                enum: [app],
                default: app
            },
            workload_pool: {
                type: "string",
                description: "Splunk workload pool to run this search in.",
                default: "standard_perf"
            }
        } };
        var required = [];
        properties.forEach(function (property) {
            var field = { type: property.type, description: property.description || property.name };
            var choices = splitList(property.choices);
            if (choices.length) { field.enum = choices.map(function (choice) { return parseChoice(choice, property.type); }); }
            schema.properties[property.name] = field;
            required.push(property.name); 
        });
        if (required.length) { schema.required = required; }
        return schema;
    }

    function createMacro(name, definition, properties) {
        var path = "/servicesNS/nobody/" + encodeURIComponent(appId()) + "/configs/conf-macros";
        return request(path, "POST", { output_mode: "json" }, {
            name: name,
            definition: definition,
            args: properties.map(function (property) { return property.name; }).join(","),
            iseval: "0"
        });
    }

    function createTool(name, properties) {
        var toolName = val("#tool-name");
        var payload = {
            name: toolName,
            title: val("#tool-title"),
            description: val("#tool-description"),
            inputSchema: buildSchema(properties),
            _meta: {
                external_app_id: appId(),
                execution: { type: "spl", template: callTemplate(name, properties), row_limiter: true, time_range: false },
                tags: ["mcp", "guided-query"],
                examples: []
            }
        };
        return request("/services/mcp_tools", "POST", null, null, JSON.stringify(payload), {
            "Content-Type": "application/json"
        });
    }

    function rejectWith(prefix) {
        return function (message) { return $.Deferred().reject(prefix + message).promise(); };
    }

    function onSubmit(event) {
        event.preventDefault();
        var $submit = $(".primary-btn");
        if ($submit.prop("disabled")) { return; }
        var existing = isExisting();
        var properties = readProperties();
        var definition = val("#macro-definition");
        var name = currentMacroName();
        var validationError = validate(properties, definition, selectedMacro());
        if (validationError) { setStatus(validationError, true); return; }
        $submit.prop("disabled", true);

        var macroStep;
        if (existing) {
            setStatus("Creating MCP tool with prebuilt macro...", false);
            macroStep = $.Deferred().resolve().promise();
        } else {
            setStatus("Creating search macro...", false);
            macroStep = createMacro(name, definition, properties).then(null, rejectWith("Macro creation failed: "));
        }
        macroStep.then(function () {
            if (!existing) { setStatus("Macro created. Creating MCP tool...", false); }
            return createTool(name, properties).then(null, rejectWith((existing ? "" : "Macro was created, but ") + "MCP tool creation failed: "));
        }).then(
            function () { setStatus("Macro and MCP tool created successfully: " + name, false); },
            function (message) { setStatus(message, true); }
        ).always(function () { $submit.prop("disabled", false); });
    }

    function onReset() {
        $("#mcp-form")[0].reset();
        $("#properties-list").empty();
        $("#external-app-id").val("search");
        $("#macro-definition").val("");
        $("#status-message").removeClass("error success").text("");
        syncMacroMode();
        loadMacros();
    }

    $(function () {
        $("#add-property").on("click", addProperty);
        $("#properties-list")
            .on("input change", ".property-row :input", updatePreview)
            .on("click", ".remove-property", onRemoveProperty);
        $("#macro-suffix").on("input", updatePreview);
        $("#macro-mode, #existing-macro").on("change", syncMacroMode);
        $("#reload-macros").on("click", loadMacros);
        $("#external-app-id").on("change", function () { if (isExisting()) { loadMacros(); } });
        $("#mcp-form").on("submit", onSubmit);
        $("#reset-btn").on("click", onReset);
        syncMacroMode();
        loadMacros();
    });
});
