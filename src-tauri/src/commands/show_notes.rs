use crate::claude;
use crate::claude::GenerationResult;
use tauri::AppHandle;

#[tauri::command]
pub async fn generate_show_notes(
    _app: AppHandle,
    api_key: String,
    transcript: String,
    system_prompt: Option<String>,
) -> Result<GenerationResult, String> {
    claude::generate_show_notes(
        &api_key,
        &transcript,
        system_prompt.as_deref(),
    )
    .await
    .map_err(|e| e.to_string())
}

#[tauri::command]
pub async fn read_transcript(file_path: String) -> Result<String, String> {
    let extension = file_path
        .rsplit('.')
        .next()
        .unwrap_or("")
        .to_lowercase();

    match extension.as_str() {
        "txt" | "md" => {
            std::fs::read_to_string(&file_path)
                .map_err(|e| format!("Failed to read file: {}", e))
        }
        "docx" => {
            // Basic DOCX text extraction: unzip and parse document.xml
            read_docx_text(&file_path)
        }
        "pdf" => {
            Err("PDF reading requires additional dependencies. Please convert to .txt first.".to_string())
        }
        _ => Err(format!("Unsupported transcript format: .{}", extension)),
    }
}

fn read_docx_text(path: &str) -> Result<String, String> {
    use std::io::Read;

    let file = std::fs::File::open(path)
        .map_err(|e| format!("Failed to open DOCX: {}", e))?;

    let mut archive = zip::ZipArchive::new(file)
        .map_err(|e| format!("Failed to read DOCX archive: {}", e))?;

    let mut document_xml = String::new();
    {
        let mut doc_entry = archive
            .by_name("word/document.xml")
            .map_err(|e| format!("Failed to find document.xml in DOCX: {}", e))?;

        // Guard against excessively large DOCX files
        if doc_entry.size() > 20 * 1024 * 1024 {
            return Err("Transcript file is too large (max 20 MB). Please convert to .txt first.".to_string());
        }

        doc_entry
            .read_to_string(&mut document_xml)
            .map_err(|e| format!("Failed to read document.xml: {}", e))?;
    }

    // XML text extraction - strip tags, detect paragraph boundaries
    let mut text = String::new();
    let mut in_tag = false;
    let mut current_tag = String::new();

    for ch in document_xml.chars() {
        match ch {
            '<' => {
                in_tag = true;
                current_tag.clear();
            }
            '>' => {
                in_tag = false;
                // Insert newline at paragraph boundaries (<w:p>, <w:p ...>, </w:p>)
                let tag_trimmed = current_tag.trim();
                if tag_trimmed == "w:p"
                    || tag_trimmed.starts_with("w:p ")
                    || tag_trimmed == "/w:p"
                {
                    if !text.ends_with('\n') {
                        text.push('\n');
                    }
                }
            }
            _ if in_tag => {
                current_tag.push(ch);
            }
            _ => {
                text.push(ch);
            }
        }
    }

    Ok(text.trim().to_string())
}
