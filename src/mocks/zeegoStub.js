// Stub for Zeego components required by Tamagui
const React = require('react');
const { View } = require('react-native');

const ZeegoStub = (props) => {
    return <View>{props.children}</View>;
};

ZeegoStub.displayName = 'ZeegoStub';

// Helper to prevent undefined errors/ensure robustness
const StubWithProps = new Proxy(ZeegoStub, {
    get: (target, prop) => {
        if (prop in target) return target[prop];
        return ZeegoStub;
    }
});

module.exports = {
    // Flat exports for require('zeego/dropdown-menu') usage
    Root: StubWithProps,
    Trigger: StubWithProps,
    Content: StubWithProps,
    Item: StubWithProps,
    ItemTitle: StubWithProps,
    ItemSubtitle: StubWithProps,
    ItemIcon: StubWithProps,
    ItemImage: StubWithProps,
    ItemIndicator: StubWithProps,
    Label: StubWithProps,
    Separator: StubWithProps,
    Group: StubWithProps,
    Sub: StubWithProps,
    SubTrigger: StubWithProps,
    SubContent: StubWithProps,
    CheckboxItem: StubWithProps,
    Arrow: StubWithProps,
    Portal: StubWithProps,
    RadioGroup: StubWithProps,
    RadioItem: StubWithProps,
    Preview: StubWithProps,
    Auxiliary: StubWithProps,

    // Nested exports just in case
    create: () => StubWithProps,
    DropdownMenu: {
        Root: StubWithProps,
        Trigger: StubWithProps,
        Content: StubWithProps,
        Item: StubWithProps,
        ItemTitle: StubWithProps,
        ItemIcon: StubWithProps,
        Label: StubWithProps,
        Separator: StubWithProps,
        Group: StubWithProps,
        CheckboxItem: StubWithProps,
        ItemIndicator: StubWithProps,
    },
    ContextMenu: {
        Root: StubWithProps,
        Trigger: StubWithProps,
        Content: StubWithProps,
        Item: StubWithProps,
        ItemTitle: StubWithProps,
        ItemIcon: StubWithProps,
        Label: StubWithProps,
        Separator: StubWithProps,
        Group: StubWithProps,
        CheckboxItem: StubWithProps,
        ItemIndicator: StubWithProps,
        Preview: StubWithProps,
    },
};
