use std::{path::Path, sync::Arc};

use rolldown::{BundlerOptions, DevModeOptions, ExperimentalOptions, InputItem};
use rolldown_common::{SourceMapPathTransform, SourceMapType};
use rolldown_testing::{manual_integration_test, test_config::TestMeta};

/// Patch rendering fails while a source file contains this marker. `hmr.hmr-0.js` has it,
/// `hmr.hmr-1.js` does not.
const FAIL_MARKER: &str = "FAIL_PATCH";

/// Fails while any source of the sourcemap contains `FAIL_MARKER`. The callback runs while
/// the patch is rendered, after the update merged the edit into the module graph.
fn fail_on_marker() -> SourceMapPathTransform {
  SourceMapPathTransform::new(Arc::new(|sources, sourcemap_path| {
    let dir = Path::new(sourcemap_path).parent().unwrap().to_path_buf();
    Box::pin(async move {
      for source in &sources {
        if std::fs::read_to_string(dir.join(source)).is_ok_and(|code| code.contains(FAIL_MARKER)) {
          anyhow::bail!("simulated failure while rendering an HMR patch");
        }
      }
      Ok(sources)
    })
  }))
}

/// - Step 0 adds `import './heavy.js'` to `hmr.js`. heavy.js is in the graph but never ran
///   (it is only behind a never-called `import()`). Rendering the patch fails.
/// - Step 1 edits `hmr.js` again. The patch must still carry heavy.js: the import was added
///   by step 0, whose patch never reached the client. Without it, the re-run of `hmr.js`
///   throws `MissingFactoryError`.
#[tokio::test(flavor = "multi_thread")]
async fn resend_update_after_failed_patch() {
  manual_integration_test!()
    .build(TestMeta::default())
    .run(BundlerOptions {
      input: Some(vec![InputItem {
        name: Some("main".to_string()),
        import: "./main.js".to_string(),
      }]),
      sourcemap: Some(SourceMapType::File),
      sourcemap_path_transform: Some(fail_on_marker()),
      experimental: Some(ExperimentalOptions {
        dev_mode: Some(DevModeOptions::default()),
        ..Default::default()
      }),
      ..Default::default()
    })
    .await;
}
