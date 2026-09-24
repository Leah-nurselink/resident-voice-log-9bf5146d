package app.lovable.residentvoicelog;

import android.os.Bundle;
import com.getcapacitor.BridgeActivity;
import com.carecore.blediscovery.CareCoreBlePlugin;

public class MainActivity extends BridgeActivity {
  @Override
  public void onCreate(Bundle savedInstanceState) {
    registerPlugin(CareCoreBlePlugin.class);
    super.onCreate(savedInstanceState);
  }
}
