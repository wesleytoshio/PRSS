import minify from 'babel-minify';
import htmlMinifier from 'html-minifier';

import { baseTemplate, getTemplate } from '../../templates';

const template_extension = 'js';

const handler: handlerType = async (templateId, data) => {
    const templateJs = await getTemplate(templateId, template_extension);

    const html = htmlMinifier.minify(
        baseTemplate({
            head: `
                <title>${data.site.title}</title>
            `,
            body: `
                <div id="root"></div>
                <script crossorigin src="https://unpkg.com/react@16/umd/react.production.min.js"></script>
                <script crossorigin src="https://unpkg.com/react-dom@16/umd/react-dom.production.min.js"></script>
                <script src="index.js"></script>
            `
        })
    , {
        collapseWhitespace: true
    });

    const js = minify(`
        ${templateJs}
        var PRSSElement = React.createElement(PRSSComponent.default, ${JSON.stringify(data)});
        ReactDOM.render(PRSSElement, document.getElementById("root"));
    `).code;

    return { html, js };
}

export default handler;