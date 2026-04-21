import nextVitals from 'eslint-config-next/core-web-vitals'

const config = [
    ...nextVitals,
    {
        rules: {
            'react-hooks/exhaustive-deps': 'off',
            '@next/next/no-img-element': 'off',
            'jsx-a11y/alt-text': 'off',
        },
    },
]

export default config
