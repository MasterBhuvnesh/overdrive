import json
import re
from typing import Dict, Any

import os
from openai import AsyncOpenAI

LM_STUDIO_MODEL = os.getenv("LM_STUDIO_MODEL", "local-model")


class LLMAgent:
    def __init__(self, api_key: str, base_url: str = None):
        self.client = AsyncOpenAI(api_key=api_key, base_url=base_url)
        self.model = LM_STUDIO_MODEL

    def _key_files_text(self, analysis: Dict) -> str:
        parts = []
        for path, content in list(analysis.get("key_files", {}).items())[:12]:
            parts.append(f"=== {path} ===\n{content[:3000]}\n")
        return "\n".join(parts)

    def _clean(self, text: str) -> str:
        """Strip markdown code fences and other non-YAML/JSON noise."""
        text = text.strip()
        # Remove any lines that are just markdown code fences (```)
        text = re.sub(r"^\s*`{3,}.*$", "", text, flags=re.MULTILINE)
        # Force-remove "version:" tags which AI stubbornly includes
        text = re.sub(r"^\s*version:.*$", "", text, flags=re.MULTILINE)
        # Final cleanup for any stray backticks or empty lines the LLM might have leaked
        text = text.replace("```", "")
        return text.strip()

    async def _generate(self, system: str, user: str) -> str:
        response = await self.client.chat.completions.create(
            model=self.model,
            messages=[
                {"role": "system", "content": system},
                {"role": "user",   "content": user},
            ],
            temperature=0.15,
            max_tokens=8192,
        )
        return response.choices[0].message.content or ""

    # ── 1. Detect stack ───────────────────────────────────────────────────────

    async def detect_stack(self, analysis: Dict) -> Dict:
        system = (
            "You are an expert DevOps engineer. "
            "Respond ONLY with valid JSON — no markdown, no explanation."
        )
        user = f"""Analyze this repository and return a JSON object describing the tech stack.

File Tree:
```
{analysis['file_tree'][:4000]}
```

Key Files:
{self._key_files_text(analysis)}

Languages detected: {json.dumps(analysis.get('detected_languages', []))}
Framework hints: {json.dumps(analysis.get('framework_hints', []))}

Return ONLY this JSON structure:
{{
  "summary": "one-line stack description",
  "primary_language": "main language",
  "frameworks": ["list"],
  "databases": ["list"],
  "build_tool": "tool name or null",
  "package_manager": "npm/yarn/pip/etc",
  "node_version": "version or null",
  "python_version": "version or null",
  "ports": [{{"service": "app", "port": 3000}}],
  "environment_variables": [{{"key": "DATABASE_URL", "description": "DB connection", "required": true}}],
  "is_monorepo": false,
  "services_detected": [{{"name": "app", "path": ".", "type": "react"}}]
}}"""

        text = self._clean(await self._generate(system, user))
        try:
            return json.loads(text)
        except json.JSONDecodeError:
            match = re.search(r"\{.*\}", text, re.DOTALL)
            if match:
                try:
                    return json.loads(match.group())
                except Exception:
                    pass
            return {
                "summary": "Unknown stack",
                "frameworks": [],
                "ports": [],
                "environment_variables": [],
                "services_detected": [],
            }

    # ── 2. Generate Dockerfiles ───────────────────────────────────────────────

    async def generate_dockerfile(self, analysis: Dict, stack: Dict) -> Dict[str, str]:
        services = stack.get("services_detected", [])
        if not services:
            services = [{"name": "app", "path": ".", "type": stack.get("primary_language", "unknown")}]

        system = (
            "You are an expert Docker engineer. "
            "Output ONLY raw Dockerfile content starting with FROM. "
            "No markdown fences, no explanation."
        )

        dockerfiles: Dict[str, str] = {}
        for svc in services:
            user = f"""Generate a production-ready multi-stage Dockerfile for this service.

Stack: {json.dumps(stack, indent=2)}
Service: {json.dumps(svc)}

Repository structure:
```
{analysis['file_tree'][:2500]}
```

Key configs:
{self._key_files_text(analysis)}

Rules:
1. Multi-stage build to minimize image size
2. Specific version tags (no 'latest')
3. Non-root user for security
4. HEALTHCHECK directive
5. Correct ports exposed
6. Layer caching optimized (deps before source)
7. CRITICAL: Examine the 'Repository structure' and 'Service Path' below VERY carefully. 
8. CRITICAL: The application is located at: {svc.get('path', '.')}
9. If the service path is not '.', YOU MUST ensure the Dockerfile sets the correct WORKDIR or copies the correct subfolder so that 'npm' or 'pip' commands find the package.json/requirements.txt.
10. ONLY generate 'COPY' commands for files or directories that you EXPLICITLY see in the file tree. Use 'COPY . .' as a fallback if needed.
11. Helpful comments throughout"""

            content = self._clean(await self._generate(system, user))
            dockerfiles[svc["name"]] = content

        return dockerfiles

    # ── 3. Generate docker-compose.yml ────────────────────────────────────────

    async def generate_compose(
        self, 
        analysis: Dict, 
        stack: Dict, 
        dockerfiles: Dict,
        env_vars: Dict[str, str] = None
    ) -> str:
        system = (
            "You are an expert DevOps engineer. "
            "Output ONLY the raw docker-compose.yml content. "
            "No markdown fences, no explanation."
        )
        
        env_text = ""
        if env_vars:
            env_text = f"User-provided Environment Variables to INCLUDE:\n{json.dumps(env_vars, indent=2)}\n"

        user = f"""Generate a complete docker-compose.yml for this project.

Stack: {json.dumps(stack, indent=2)}
Dockerfiles generated for services: {list(dockerfiles.keys())}
{env_text}
Environment variables needed: {json.dumps(stack.get('environment_variables', []), indent=2)}
Ports: {json.dumps(stack.get('ports', []), indent=2)}
Databases: {json.dumps(stack.get('databases', []), indent=2)}

Repository structure:
```
{analysis['file_tree'][:1500]}
```

Rules:
1. CRITICAL: Omit the 'version' attribute entirely (modern specification). 
2. Include all services: app + databases + cache + nginx if needed
3. Named volumes for persistent data
4. Health checks for databases (mongo, postgres, redis, etc.)
5. CRITICAL: Use the simple array format for 'depends_on'. Example: `depends_on: ["db", "redis"]`. Do NOT use the long form with conditions.
6. restart: unless-stopped
7. CRITICAL: For app services, add 'env_file: .env' to the service block.
8. CRITICAL: For EVERY user-provided env var (listed above), you MUST add it to the 'environment' section of the relevant app service using the syntax 'KEY: ${{KEY}}'.
9. Helpful comments
10. CRITICAL: For each app service build section, use EXACTLY this format to avoid "pulling from remote" errors:
   build:
     context: .
     dockerfile: Dockerfile.<service_name>
   where <service_name> matches the key in the Dockerfiles list above.
   Example: if service is "app" → dockerfile: Dockerfile.app
   Service names MUST match the keys provided above exactly."""

        return self._clean(await self._generate(system, user))

    # ── 4. Analyze errors & improvements ─────────────────────────────────────

    async def analyze_errors(self, analysis: Dict, stack: Dict) -> str:
        system = "You are an expert code reviewer and security engineer."
        user = f"""Produce a detailed improvement report for this repository.

Stack: {json.dumps(stack, indent=2)}

File Tree:
```
{analysis['file_tree'][:3000]}
```

Key Files:
{self._key_files_text(analysis)}

Write a Markdown report with these sections (use emojis for headers):
# 🔍 Overdrive Analysis Report
## Summary
## 🚫 Critical Issues (file, problem, exact fix)
## ⚠️ Warnings
## 💡 Recommendations
## 🐳 Docker & Deployment Notes
## ✅ What's Good
## 📋 Quick Fix Checklist (checkboxes)

Be specific: reference file names and give exact code fixes where relevant."""

        return await self._generate(system, user)
