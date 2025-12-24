using System;
using System.Collections.Generic;
using System.Linq;
using System.Text;
using efipaceservices;

namespace Pace_Web_Service_SDK.sample
{
    class SystemInspector
    {
        public static void Run()
        {
            SystemInspectorHttpBinding systemInspectorHttpBinding = PaceClient.getSystemInspectorHttpBinding();
            /**
              * com.pace2020.epace.web.objectcontext.UserDefinedObjectContextsManager[ePace Mobile]
              * com.pace2020.appbox.web.form.ValidFormInspectionTarget[ePace Mobile]
              * com.pace2020.appbox.web.form.ValidFormInspectionTarget[ePace (UI 3.0)]
              * com.pace2020.epace.web.menu.UserDefinedMenuManagerManager[eService]
              * com.pace2020.appbox.blocks.inspection.CustomizationsVerificationInspectionTarget
              * com.pace2020.epace.web.menu.UserDefinedMenuManagerManager[ePace (UI 3.0)]
              * com.pace2020.appbox.web.form.ValidFormInspectionTarget[eService]
              * com.pace2020.appbox.blocks.objectmodel.inspection.XPathFieldValueVerificationInspectionTarget
              * com.pace2020.appbox.blocks.objectmodel.inspection.XPathReportParameterVerificationInspectionTarget
              * com.pace2020.epace.web.menu.UserDefinedMenuManagerManager[ePace Mobile]
              * com.pace2020.appbox.blocks.objectmodelmetadata.XPathCalculatedFieldVerificationInspectionTarget
              * com.pace2020.epace.web.objectcontext.UserDefinedObjectContextsManager[eService]
              * com.pace2020.epace.web.objectcontext.UserDefinedObjectContextsManager[ePace (UI 3.0)]
              * com.pace2020.appbox.blocks.objectmodelmetadata.OnCreateXPathDefaultVerificationInspectionTarget
              * com.pace2020.appbox.blocks.objectmodelmetadata.XPathConditionVerificationInspectionTarget
              * com.pace2020.appbox.blocks.objectmodelmetadata.OnPersistXPathDefaultVerificationInspectionTarget
              * com.pace2020.epace.blocks.event.EventHandlerDefinitionXPathVerificationInspectionTarget
              */
            try
            {
                String[] keys = systemInspectorHttpBinding.inspect("com.pace2020.appbox.web.form.ValidFormInspectionTarget[ePace Mobile]");
                Console.WriteLine(keys.Length + " Messages");
            }
            catch (Exception e)
            {
                Console.WriteLine(e.Message);
            }
        }
    }
}
