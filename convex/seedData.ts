// Sample teachers. Photos live in public/teachers/<slug>.webp
export const TEACHERS = [
	{
		slug: "valentina-rios",
		name: "Valentina Ríos",
		headline: "LLMs, prompting y RAG",
		bio: "Ingeniera de machine learning con 8 años de experiencia. Ayuda a equipos a pasar de prototipos con LLMs a productos confiables: diseño de prompts, evaluación y búsqueda aumentada.",
		specialties: ["LLMs", "Prompt engineering", "RAG"],
	},
	{
		slug: "martin-ocampo",
		name: "Martín Ocampo",
		headline: "Visión por computadora",
		bio: "Investigador en visión artificial. Enseña desde redes convolucionales hasta modelos de detección y segmentación, siempre con proyectos prácticos en PyTorch.",
		specialties: ["Visión por computadora", "Deep learning", "PyTorch"],
	},
	{
		slug: "lucia-fernandez",
		name: "Lucía Fernández",
		headline: "Procesamiento de lenguaje natural",
		bio: "Doctora en lingüística computacional. Explica cómo funcionan los transformers por dentro y cómo ajustar modelos de lenguaje a tu dominio.",
		specialties: ["NLP", "Transformers", "Fine-tuning"],
	},
	{
		slug: "diego-herrera",
		name: "Diego Herrera",
		headline: "MLOps y modelos en producción",
		bio: "Lleva modelos a producción desde 2016. Pipelines reproducibles, serving, monitoreo de drift y control de costos.",
		specialties: ["MLOps", "Despliegue de modelos", "Monitoreo"],
	},
	{
		slug: "camila-sosa",
		name: "Camila Sosa",
		headline: "Aprendizaje por refuerzo y ética en IA",
		bio: "Docente universitaria e investigadora en agentes. Combina los fundamentos del aprendizaje por refuerzo con una mirada crítica sobre sesgos y uso responsable de la IA.",
		specialties: ["Aprendizaje por refuerzo", "Agentes", "Ética en IA"],
	},
] as const;
