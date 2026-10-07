/**
 * The skills and roles "For you" knows by name: for spotting them in a CV and
 * for suggestions while typing. Anyone can still type something not listed;
 * it's then matched as plain words.
 *
 * `aliases` are other ways a CV writes the same thing. `literal` is for names
 * Postgres' text search can't see (C++ and C# both index as the letter "c"):
 * those are matched as a substring of the posting instead.
 */
export type Skill = { name: string; aliases?: string[]; literal?: string; caseSensitive?: boolean };

export const SKILLS: Skill[] = [
  // Languages
  { name: "Python" }, { name: "JavaScript", aliases: ["JS", "ECMAScript"] }, { name: "TypeScript" },
  { name: "Java" }, { name: "Kotlin" }, { name: "Swift" }, { name: "Objective-C" },
  { name: "Go", aliases: ["Golang"], caseSensitive: true }, { name: "Rust" }, { name: "Ruby" }, { name: "PHP" },
  { name: "C++", literal: "c++" }, { name: "C#", literal: "c#" },
  { name: "Scala" }, { name: "Elixir" }, { name: "Erlang" }, { name: "Haskell" }, { name: "Clojure" },
  { name: "Dart" }, { name: "MATLAB" },
  { name: "Perl" }, { name: "Lua" }, { name: "Bash", aliases: ["Shell scripting"] }, { name: "PowerShell" },
  { name: "SQL" }, { name: "Solidity" }, { name: "Zig", caseSensitive: true }, { name: "COBOL" },
  // Web and mobile
  { name: "React", aliases: ["React.js", "ReactJS"] }, { name: "React Native" }, { name: "Next.js", aliases: ["NextJS"] },
  { name: "Vue", aliases: ["Vue.js", "VueJS"] }, { name: "Nuxt" }, { name: "Angular", aliases: ["AngularJS"] },
  { name: "Svelte" }, { name: "Redux" }, { name: "GraphQL" }, { name: "REST APIs", aliases: ["REST", "RESTful"] },
  { name: "gRPC" }, { name: "HTML" }, { name: "CSS" }, { name: "Tailwind", aliases: ["Tailwind CSS", "TailwindCSS"] },
  { name: "Sass", aliases: ["SCSS"] }, { name: "Webpack" }, { name: "Vite" },
  { name: "Node.js", aliases: ["Node", "NodeJS"] }, { name: "Express.js", aliases: ["ExpressJS"] }, { name: "NestJS" },
  { name: "Deno" }, { name: "Django" }, { name: "Flask" }, { name: "FastAPI" }, { name: "Rails", aliases: ["Ruby on Rails"] },
  { name: "Laravel" }, { name: "Symfony" }, { name: "Spring Boot", aliases: ["Spring Framework"] }, { name: ".NET", aliases: ["ASP.NET", "dotnet", ".NET Core"], literal: ".net" },
  { name: "Flutter" }, { name: "iOS" }, { name: "Android" }, { name: "SwiftUI" }, { name: "Jetpack Compose" },
  { name: "Unity" }, { name: "Unreal Engine", aliases: ["Unreal"] }, { name: "WebAssembly", aliases: ["Wasm"] },
  { name: "Accessibility", aliases: ["a11y", "WCAG"] },
  // Data and ML
  { name: "PostgreSQL", aliases: ["Postgres"] }, { name: "MySQL" }, { name: "SQLite" }, { name: "MongoDB", aliases: ["Mongo"] },
  { name: "Redis" }, { name: "Elasticsearch", aliases: ["OpenSearch"] }, { name: "Cassandra" }, { name: "DynamoDB" },
  { name: "Snowflake" }, { name: "BigQuery" }, { name: "Redshift" }, { name: "Databricks" }, { name: "ClickHouse" },
  { name: "Kafka", aliases: ["Apache Kafka"] }, { name: "RabbitMQ" }, { name: "Spark", aliases: ["Apache Spark", "PySpark"] },
  { name: "Airflow", aliases: ["Apache Airflow"] }, { name: "dbt" }, { name: "Hadoop" }, { name: "Flink" },
  { name: "ETL", aliases: ["ELT"] }, { name: "Data modeling", aliases: ["Data modelling"] }, { name: "Data warehousing" },
  { name: "Pandas" }, { name: "NumPy" }, { name: "scikit-learn", aliases: ["sklearn"] }, { name: "PyTorch" },
  { name: "TensorFlow" }, { name: "Keras" }, { name: "JAX", caseSensitive: true }, { name: "Hugging Face", aliases: ["HuggingFace", "Transformers"] },
  { name: "LLMs", aliases: ["LLM", "Large language models"] }, { name: "RAG", aliases: ["Retrieval augmented generation"], caseSensitive: true },
  { name: "LangChain" }, { name: "Machine learning", aliases: ["ML"] }, { name: "Deep learning" },
  { name: "NLP", aliases: ["Natural language processing"] }, { name: "Computer vision" }, { name: "MLOps" },
  { name: "Statistics" }, { name: "A/B testing", aliases: ["Experimentation"] }, { name: "Tableau" },
  { name: "Power BI", aliases: ["PowerBI"] }, { name: "Looker" }, { name: "Excel", aliases: ["Microsoft Excel"] },
  { name: "Data analysis", aliases: ["Data analytics"] }, { name: "Data visualization", aliases: ["Data visualisation"] },
  // Infrastructure
  { name: "AWS", aliases: ["Amazon Web Services"] }, { name: "GCP", aliases: ["Google Cloud"] }, { name: "Azure" },
  { name: "Docker" }, { name: "Kubernetes", aliases: ["K8s"] }, { name: "Terraform" }, { name: "Ansible" },
  { name: "Helm" }, { name: "Linux" }, { name: "CI/CD" }, { name: "GitHub Actions" }, { name: "Jenkins" },
  { name: "Git" }, { name: "Prometheus" }, { name: "Grafana" }, { name: "Datadog" }, { name: "Observability" },
  { name: "Serverless", aliases: ["Lambda", "AWS Lambda"] }, { name: "Microservices" }, { name: "Distributed systems" },
  { name: "System design" }, { name: "Networking", aliases: ["TCP/IP"] }, { name: "SRE", aliases: ["Site reliability"] },
  { name: "Security", aliases: ["Cybersecurity", "Information security", "InfoSec"] }, { name: "Penetration testing", aliases: ["Pentesting"] },
  { name: "IAM" }, { name: "SOC 2", aliases: ["SOC2"] }, { name: "Embedded systems", aliases: ["Embedded"] },
  { name: "FPGA" }, { name: "Verilog" }, { name: "Blockchain", aliases: ["Web3"] },
  // Quality
  { name: "Test automation", aliases: ["Automated testing"] }, { name: "Selenium" }, { name: "Cypress" },
  { name: "Playwright" }, { name: "Jest" }, { name: "pytest" }, { name: "QA", aliases: ["Quality assurance"] },
  // Design and product
  { name: "Figma" }, { name: "Sketch", caseSensitive: true }, { name: "Adobe Creative Suite", aliases: ["Photoshop", "Illustrator", "InDesign"] },
  { name: "UX research", aliases: ["User research"] }, { name: "UI design" }, { name: "Prototyping" },
  { name: "Design systems" }, { name: "Product management" }, { name: "Roadmapping", aliases: ["Product roadmap"] },
  { name: "Agile", aliases: ["Scrum", "Kanban"] }, { name: "Jira" }, { name: "Stakeholder management" },
  { name: "Technical writing" },
  // Business
  { name: "Salesforce" }, { name: "HubSpot" }, { name: "CRM" }, { name: "B2B sales", aliases: ["B2B"] },
  { name: "SaaS" }, { name: "Account management" }, { name: "Business development" }, { name: "Lead generation" },
  { name: "Negotiation" }, { name: "SEO", aliases: ["Search engine optimization"] }, { name: "SEM", aliases: ["Google Ads", "PPC"] },
  { name: "Content marketing" }, { name: "Copywriting" }, { name: "Social media", aliases: ["Social media marketing"] },
  { name: "Email marketing" }, { name: "Marketing automation" }, { name: "Google Analytics", aliases: ["GA4"] },
  { name: "Brand strategy", aliases: ["Branding"] }, { name: "Growth marketing" },
  { name: "Customer success" }, { name: "Customer support", aliases: ["Customer service"] }, { name: "Zendesk" },
  { name: "Project management", aliases: ["PMP"] }, { name: "Business operations" },
  { name: "Supply chain", aliases: ["Logistics"] }, { name: "Procurement" },
  { name: "Accounting", aliases: ["Bookkeeping"] }, { name: "Financial modeling", aliases: ["Financial modelling"] },
  { name: "FP&A", literal: "fp&a" }, { name: "Audit", aliases: ["Auditing"] }, { name: "Tax" }, { name: "Payroll" },
  { name: "GAAP", aliases: ["IFRS"] }, { name: "NetSuite" }, { name: "SAP", caseSensitive: true }, { name: "QuickBooks" },
  { name: "Recruiting", aliases: ["Recruitment", "Talent acquisition"] }, { name: "HR", aliases: ["Human resources", "People operations"] },
  { name: "Compliance" }, { name: "Risk management" },
  // Healthcare
  { name: "Nursing", aliases: ["RN", "Registered nurse"] }, { name: "Clinical research" }, { name: "Patient care" },
  { name: "EHR", aliases: ["Electronic health records"] }, { name: "HIPAA" },
  // Languages people speak
  { name: "Spanish" }, { name: "French" }, { name: "German" }, { name: "Mandarin", aliases: ["Chinese"] },
  { name: "Japanese" }, { name: "Portuguese" }, { name: "Arabic" }, { name: "Hindi" },
];

/** Roles to suggest while typing, and to look for in a CV. */
export const ROLES: string[] = [
  "Software Engineer", "Backend Engineer", "Frontend Engineer", "Full Stack Engineer", "Mobile Engineer",
  "iOS Engineer", "Android Engineer", "Platform Engineer", "Infrastructure Engineer", "DevOps Engineer",
  "Site Reliability Engineer", "Cloud Engineer", "Security Engineer", "Embedded Engineer", "Firmware Engineer",
  "QA Engineer", "Test Engineer", "Data Engineer", "Analytics Engineer", "Machine Learning Engineer",
  "AI Engineer", "Research Scientist", "Applied Scientist", "Data Scientist", "Data Analyst",
  "Business Analyst", "Business Intelligence Analyst", "Solutions Engineer", "Sales Engineer",
  "Solutions Architect", "Software Architect", "Engineering Manager", "Technical Lead", "Staff Engineer",
  "Developer Advocate", "Technical Writer", "Game Developer", "Blockchain Engineer", "Network Engineer",
  "Systems Administrator", "IT Support", "Database Administrator",
  "Product Manager", "Technical Product Manager", "Product Owner", "Program Manager", "Project Manager",
  "Product Designer", "UX Designer", "UI Designer", "UX Researcher", "Graphic Designer", "Brand Designer",
  "Content Designer", "Motion Designer",
  "Marketing Manager", "Product Marketing Manager", "Growth Marketing Manager", "Content Marketing Manager",
  "SEO Specialist", "Social Media Manager", "Copywriter", "Community Manager",
  "Account Executive", "Sales Development Representative", "Business Development Representative",
  "Account Manager", "Customer Success Manager", "Partnerships Manager", "Sales Manager",
  "Customer Support Specialist", "Support Engineer", "Implementation Specialist",
  "Operations Manager", "Business Operations", "Revenue Operations", "Supply Chain Analyst",
  "Financial Analyst", "Accountant", "Controller", "Finance Manager", "Payroll Specialist",
  "Recruiter", "Technical Recruiter", "HR Business Partner", "People Operations",
  "Legal Counsel", "Paralegal", "Compliance Analyst", "Risk Analyst",
  "Registered Nurse", "Clinical Research Associate", "Medical Assistant", "Pharmacist",
  "Executive Assistant", "Office Manager", "Chief of Staff",
];

const ESCAPE = /[.*+?^${}()|[\]\\]/g;

/** A regex for a name as a whole word, also when it starts or ends in a symbol (C++, .NET). */
function wordPattern(name: string): string {
  const body = name.replace(ESCAPE, "\\$&");
  // Not part of a longer name: "Java" in "JavaScript", "Node" in "Node.js".
  return `(?<![\\w+#.])${body}(?![\\w+#]|\\.\\w)`;
}

function countIn(text: string, name: string, caseSensitive?: boolean): number {
  return text.match(new RegExp(wordPattern(name), caseSensitive ? "g" : "gi"))?.length ?? 0;
}

/** Listed skills a text mentions, most mentioned first. */
export function findSkills(text: string, max = 25): string[] {
  const found: [string, number][] = [];
  for (const skill of SKILLS) {
    const n = [skill.name, ...(skill.aliases ?? [])].reduce(
      (sum, name) => sum + countIn(text, name, skill.caseSensitive),
      0,
    );
    if (n > 0) found.push([skill.name, n]);
  }
  return found.sort((a, b) => b[1] - a[1]).slice(0, max).map(([name]) => name);
}

/**
 * Listed roles a text mentions, most mentioned first. "Senior", "Lead" and the
 * like don't matter: "Senior Data Engineer" counts for "Data Engineer".
 */
export function findRoles(text: string, max = 3): string[] {
  const found: [string, number][] = [];
  for (const role of ROLES) {
    const variants = [role, role.replace(/Engineer$/, "Developer")];
    const n = variants.reduce((sum, name) => sum + countIn(text, name), 0);
    if (n > 0) found.push([role, n]);
  }
  // A longer name that matched is more specific than its shorter cousin.
  return found
    .sort((a, b) => b[1] - a[1] || b[0].length - a[0].length)
    .slice(0, max)
    .map(([name]) => name);
}

const EDUCATION = /\b(university|college|school|institute|academy|bachelor|master|b\.?sc|m\.?sc|mba|ph\.?d|degree|diploma|graduat\w*|studies)\b/i;
const MONTHS = "jan|feb|mar|apr|may|jun|jul|aug|sep|sept|oct|nov|dec";

/**
 * Years of experience from the date ranges on a CV ("2019 – Present",
 * "Mar 2021 - Jun 2023"): from the earliest start to the latest end. Gaps and
 * overlaps aren't worked out; it's a starting point the person can change.
 */
export function findYears(text: string, now = new Date()): number | null {
  const range = new RegExp(
    `(?:(?:${MONTHS})[a-z]*\\.?\\s+)?((?:19|20)\\d{2})\\s*(?:-|–|—|to)\\s*(?:(?:${MONTHS})[a-z]*\\.?\\s+)?((?:19|20)\\d{2}|present|current|now|today)`,
    "gi",
  );
  let start = Infinity;
  let end = -Infinity;
  for (const m of text.matchAll(range)) {
    // Study isn't work experience: skip ranges on a line about a degree.
    const lineStart = text.lastIndexOf("\n", m.index) + 1;
    const lineEnd = text.indexOf("\n", m.index + m[0].length);
    if (EDUCATION.test(text.slice(lineStart, lineEnd === -1 ? undefined : lineEnd))) continue;
    const from = Number(m[1]);
    const to = /^\d/.test(m[2]) ? Number(m[2]) : now.getFullYear();
    if (from > to || from < now.getFullYear() - 50) continue;
    start = Math.min(start, from);
    end = Math.max(end, to);
  }
  return Number.isFinite(start) ? Math.max(0, end - start) : null;
}

/** Years -> the experience filter's bucket. */
export function expBucket(years: number | null): string | undefined {
  if (years === null) return undefined;
  if (years < 1) return "0-1";
  if (years < 3) return "1-2";
  if (years < 6) return "3-5";
  return "5+";
}

export function skillFor(name: string): Skill | undefined {
  const lower = name.toLowerCase();
  return SKILLS.find((s) => s.name.toLowerCase() === lower || s.aliases?.some((a) => a.toLowerCase() === lower));
}
