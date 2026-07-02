(function () {
	"use strict";

	var searchablePages = [
		{ url: "index.html", title: "Home" },
		{ url: "PEOPLE.html", title: "All Group Pictures" },
		{ url: "CURRENT_MEMBERS.html", title: "Current Members" },
		{ url: "FORMER_MEMBERS.html", title: "Former Members" },
		{ url: "RESEARCH.html", title: "Research" },
		{ url: "TUTORIALS.html", title: "Tutorials" },
		{ url: "PUBLICATIONS.html", title: "Publications" },
		{ url: "FUNDING.html", title: "Funding" }
	];

	function normalize(value) {
		return (value || "").replace(/\s+/g, " ").trim();
	}

	function countMatches(text, term) {
		var count = 0;
		var position = 0;
		while ((position = text.indexOf(term, position)) !== -1) {
			count += 1;
			position += term.length;
		}
		return count;
	}

	function makeSnippet(text, terms) {
		var lowerText = text.toLowerCase();
		var position = -1;
		for (var i = 0; i < terms.length; i += 1) {
			var candidate = lowerText.indexOf(terms[i]);
			if (candidate !== -1 && (position === -1 || candidate < position)) {
				position = candidate;
			}
		}
		if (position === -1) {
			position = 0;
		}
		var start = Math.max(0, position - 110);
		var end = Math.min(text.length, position + 230);
		return (start > 0 ? "…" : "") + text.slice(start, end).trim() + (end < text.length ? "…" : "");
	}

	function configureSearchForms() {
		var forms = document.querySelectorAll('form[role="search"]');
		for (var i = 0; i < forms.length; i += 1) {
			var form = forms[i];
			var input = form.querySelector('input[type="search"]');
			if (!input) {
				continue;
			}
			form.action = "SEARCH.html";
			form.method = "get";
			input.name = "q";
			input.placeholder = "Search site…";
			input.setAttribute("aria-label", "Search all site content");
			var hiddenInputs = form.querySelectorAll('input[type="hidden"]');
			for (var j = 0; j < hiddenInputs.length; j += 1) {
				hiddenInputs[j].remove();
			}
		}
	}

	function renderMessage(container, message) {
		container.innerHTML = "";
		var paragraph = document.createElement("p");
		paragraph.className = "search-message";
		paragraph.textContent = message;
		container.appendChild(paragraph);
	}

	function renderResult(container, result) {
		var article = document.createElement("article");
		article.className = "search-result";
		var heading = document.createElement("h2");
		var link = document.createElement("a");
		link.href = result.url;
		link.textContent = result.title;
		heading.appendChild(link);
		var snippet = document.createElement("p");
		snippet.textContent = result.snippet;
		article.appendChild(heading);
		article.appendChild(snippet);
		container.appendChild(article);
	}

	async function searchPage(page, terms) {
		var response = await fetch(page.url, { cache: "no-cache" });
		if (!response.ok) {
			throw new Error("Could not load " + page.url);
		}
		var html = await response.text();
		var documentCopy = new DOMParser().parseFromString(html, "text/html");
		var main = documentCopy.querySelector("main");
		if (!main) {
			return null;
		}
		var unwanted = main.querySelectorAll("script, style, form, noscript");
		for (var i = 0; i < unwanted.length; i += 1) {
			unwanted[i].remove();
		}
		var text = normalize(main.textContent);
		var headingText = normalize(Array.prototype.map.call(
			main.querySelectorAll("h1, h2, h3"),
			function (heading) { return heading.textContent; }
		).join(" "));
		var lowerText = text.toLowerCase();
		var lowerHeadings = headingText.toLowerCase();
		var lowerTitle = page.title.toLowerCase();
		for (var j = 0; j < terms.length; j += 1) {
			if (lowerText.indexOf(terms[j]) === -1 && lowerTitle.indexOf(terms[j]) === -1) {
				return null;
			}
		}
		var score = 0;
		for (var k = 0; k < terms.length; k += 1) {
			score += countMatches(lowerText, terms[k]);
			score += countMatches(lowerHeadings, terms[k]) * 8;
			score += countMatches(lowerTitle, terms[k]) * 20;
		}
		return {
			url: page.url,
			title: page.title,
			score: score,
			snippet: makeSnippet(text, terms)
		};
	}

	async function renderSearchResults() {
		var resultsContainer = document.getElementById("search-results");
		var summary = document.getElementById("search-summary");
		if (!resultsContainer || !summary) {
			return;
		}
		var query = normalize(new URLSearchParams(window.location.search).get("q"));
		var pageInput = document.getElementById("site-search-input");
		if (pageInput) {
			pageInput.value = query;
		}
		if (!query) {
			summary.textContent = "Enter a word or phrase to search the entire site.";
			renderMessage(resultsContainer, "Try a topic, author, publication title, year, or group member.");
			return;
		}
		var terms = query.toLowerCase().split(" ").filter(function (term) {
			return term.length > 0;
		});
		summary.textContent = 'Searching for “' + query + '”';
		renderMessage(resultsContainer, "Searching…");
		try {
			var responses = await Promise.all(searchablePages.map(function (page) {
				return searchPage(page, terms);
			}));
			var results = responses.filter(Boolean).sort(function (a, b) {
				return b.score - a.score;
			});
			resultsContainer.innerHTML = "";
			summary.textContent = results.length + (results.length === 1 ? " page found" : " pages found") + ' for “' + query + '”';
			if (!results.length) {
				renderMessage(resultsContainer, "No matching content was found. Try fewer or more general words.");
				return;
			}
			for (var i = 0; i < results.length; i += 1) {
				renderResult(resultsContainer, results[i]);
			}
		} catch (error) {
			summary.textContent = "Search could not be completed.";
			renderMessage(resultsContainer, "Please reload the page and try again.");
		}
	}

	document.addEventListener("DOMContentLoaded", function () {
		configureSearchForms();
		renderSearchResults();
	});
}());