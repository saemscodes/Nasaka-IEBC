export const config = {
    runtime: 'edge',
};

export default async function handler(req: Request) {
    if (req.method !== 'POST') {
        return new Response('Method Not Allowed', { status: 405 });
    }

    try {
        const { scriptId, params } = await req.json();

        // Validate request (Add basic auth check here if needed, 
        // though the AdminNexus already checks auth)

        const GITHUB_TOKEN = process.env.GITHUB_TOKEN;
        const REPO_OWNER = "saemscodes"; // Derived from user context
        const REPO_NAME = "Nasaka-IEBC";  // Derived from user context

        if (!GITHUB_TOKEN) {
            return new Response(JSON.stringify({ error: 'GITHUB_TOKEN not configured' }), {
                status: 500,
                headers: { 'Content-Type': 'application/json' }
            });
        }

        // Trigger GitHub Workflow Dispatch
        // Map scriptId to workflow filename
        const workflowMap: Record<string, string> = {
            'iebc_verification': 'admin-task-runner.yml',
            'coord_correction': 'admin-task-runner.yml',
            'geocode_resolve': 'admin-task-runner.yml',
            'hitl_full_audit': 'admin-task-runner.yml',
            'geocode_sync': 'admin-task-runner.yml',
        };

        const workflowFile = workflowMap[scriptId as string] || 'daily-iebc-verify.yml';

        const response = await fetch(
            `https://api.github.com/repos/${REPO_OWNER}/${REPO_NAME}/actions/workflows/${workflowFile}/dispatches`,
            {
                method: 'POST',
                headers: {
                    'Authorization': `Bearer ${GITHUB_TOKEN}`,
                    'Accept': 'application/vnd.github.v3+json',
                    'Content-Type': 'application/json',
                    'User-Agent': 'Nasaka-Admin-Trigger'
                },
                body: JSON.stringify({
                    ref: 'main',
                    inputs: {
                        task_id: params?.taskId || '',
                        task_type: scriptId,
                        skip_nominatim: params?.quick === true ? 'true' : 'false',
                        run_resolver: scriptId === 'geocode_resolve' ? 'true' : 'false',
                        shapefile_path: params?.shapefile_path || 'data/constituencies.shp'
                    }
                }),
            }
        );

        if (!response.ok) {
            const error = await response.text();
            return new Response(JSON.stringify({ error: `GitHub API error: ${error}` }), {
                status: response.status,
                headers: { 'Content-Type': 'application/json' }
            });
        }

        return new Response(JSON.stringify({ success: true, message: `Dispatched ${workflowFile}` }), {
            status: 200,
            headers: { 'Content-Type': 'application/json' }
        });

    } catch (error: any) {
        return new Response(JSON.stringify({ error: error.message }), {
            status: 500,
            headers: { 'Content-Type': 'application/json' }
        });
    }
}
