using System;
using System.Collections.Generic;
using efipaceservices;
using System.IO;

namespace Pace_Web_Service_SDK.sample
{
    class ReportServiceSample
    {
        private static FindObjectsPortType findObjectsHttpBinding = PaceClient.getFindObjectsHttpBinding();

        public static void Run()
        {
            printReportList();
            Console.WriteLine("Enter the report Id for reading the report");
            string reportId = Console.ReadLine();
            ValueObject[] reportParametersValueObjectArray = getReportParameters(reportId);
            readReport(reportId, reportParametersValueObjectArray);
        }


        public static void printReportList()
        {
            ValueObjectDescriptor reportDescriptor = createValueObjectDescriptorForReport("@active='true'");

            ValueObjectsGroup valueObjectGroup = findObjectsHttpBinding.loadValueObjects(reportDescriptor);
            Console.WriteLine("Total Number of active reports : " + valueObjectGroup.totalRecords);

            ValueObject[] valueObjectArray = valueObjectGroup.valueObjects;

            foreach (ValueObject valueObject in valueObjectArray)
            {
                ValueField[] fields = valueObject.fields;

                foreach (ValueField valueField in fields)
                {
                    Console.Write("   " + valueField.value + "   ");
                }

                Console.WriteLine();
            }
        }

        private static ValueObject[] getReportParameters(string reportId)
        {
            ValueObjectDescriptor reportDescriptor = createValueObjectDescriptorForReport("@id=" + reportId);

            // Create ValueObjectDescriptor for ReportParameter
            ValueObjectDescriptor reportParameterDescriptor = new ValueObjectDescriptor();
            reportParameterDescriptor.objectName = "ReportParameter";
            // Get promptable ReportParameter
            //reportParameterDescriptor.xpathFilter = "@prompt=true";
            reportParameterDescriptor.offset = 0;
            reportParameterDescriptor.limit = 1000;

            // Create fields to lookup for ReportParameter Object
            List<FieldDescriptor> reportFieldDescriptors = new List<FieldDescriptor>();

            FieldDescriptor fieldDescriptor1 = new FieldDescriptor();
            fieldDescriptor1.name = "id";
            fieldDescriptor1.xpath = "@id";
            reportFieldDescriptors.Add(fieldDescriptor1);

            FieldDescriptor fieldDescriptor2 = new FieldDescriptor();
            fieldDescriptor2.name = "Expression Type";
            fieldDescriptor2.xpath = "@expressionType";
            reportFieldDescriptors.Add(fieldDescriptor2);

            FieldDescriptor fieldDescriptor3 = new FieldDescriptor();
            fieldDescriptor3.name = "Expression";
            fieldDescriptor3.xpath = "@expression";
            reportFieldDescriptors.Add(fieldDescriptor3);

            reportParameterDescriptor.fields = reportFieldDescriptors.ToArray();

            reportDescriptor.children = new ValueObjectDescriptor[1];
            reportDescriptor.children[0] = reportParameterDescriptor;

            ValueObjectsGroup valueObjectGroup = findObjectsHttpBinding.loadValueObjects(reportDescriptor);

            ValueObject[] reportParameterValueObjects = null;
            // Usually there is only one record.
            if( valueObjectGroup.valueObjects.Length != 0 )
            {
                ValueObject valueObject = valueObjectGroup.valueObjects[0];
                ValueObjectsGroup[] reportParametersVOGroup = valueObject.children;

                if (reportParametersVOGroup.Length != 0)
                {
                    reportParameterValueObjects = reportParametersVOGroup[0].valueObjects;
                    Console.WriteLine("   id      type      value");
                    foreach (ValueObject reportParameterValueObject in reportParameterValueObjects)
                    {
                        ValueField[] valueFields = reportParameterValueObject.fields;

                        foreach (ValueField valueField in valueFields)
                        {
                            Console.Write("   " + valueField.value + "   ");
                        }
                        Console.WriteLine();
                    }
                }
            }
            else
            {
                Console.WriteLine("Entered report id doesn't exist in the system.");
            }

            return reportParameterValueObjects;
        }

        private static ValueObjectDescriptor createValueObjectDescriptorForReport(string filter)
        {
            // 1. Create a ValueObjectDescriptor with objectName as Report.
            ValueObjectDescriptor reportDescriptor = new ValueObjectDescriptor();
            reportDescriptor.objectName = "Report";
            reportDescriptor.xpathFilter = filter;
            reportDescriptor.offset = 0;
            reportDescriptor.limit = 1000;
            
            //2. Create Look up fields of Report Object.
            List<FieldDescriptor> reportFieldDescriptors = new List<FieldDescriptor>();
            FieldDescriptor fieldDescriptor1 = new FieldDescriptor();
            fieldDescriptor1.name = "id";
            fieldDescriptor1.xpath = "@id";

            reportFieldDescriptors.Add(fieldDescriptor1);

            FieldDescriptor fieldDescriptor2 = new FieldDescriptor();
            fieldDescriptor2.name = "Name";
            fieldDescriptor2.xpath = "@displayName";

            reportFieldDescriptors.Add(fieldDescriptor2);

            reportDescriptor.fields = reportFieldDescriptors.ToArray();

            return reportDescriptor;
        }

        private static void readReport(string reportId, ValueObject[] valueObjects)
        {
            ReportServicePortType reportServiceHttpBinding = PaceClient.getReportServiceHttpBinding();

            //1. Create ReportWrapper
            ReportWrapper reportWrapper = new ReportWrapper();
            
            //2. Create Report with its id set and set it to the ReportWrapper
            reportWrapper.reportId = reportId;

            // 3. Create ReportParameterWrapper array.
            ReportParameterWrapper[] array = new ReportParameterWrapper[valueObjects.Length];
            reportWrapper.reportParameterWrappers = array;

            for(int index=0; index < valueObjects.Length; index++)
            {
                ValueObject valueObject = valueObjects[index];
                ValueField[] valueFieldArray = valueObject.fields;

                ReportParameterWrapper reportParameterWrapper = new ReportParameterWrapper();
                

                for (int i=0; i < valueFieldArray.Length; i++)
                {
                    ValueField valueField = valueFieldArray[i];
                    if (i == 1)
                    {
                        reportParameterWrapper.reportParameterId = valueField.value;
                    }
                    if (i == 2)
                    {
                        reportParameterWrapper.value = valueField.value;
                    }
                }
                array[index] = reportParameterWrapper;
            }

            // 4. Read the report Or
            reportWrapper = reportServiceHttpBinding.executeReport(reportWrapper);

            // Print Report
            reportServiceHttpBinding.printReport(reportWrapper);

            // 5. Decode the content obtained from executeReport call.
            byte[] decoded = System.Convert.FromBase64String(reportWrapper.content);

            // 6. Write the content to the file.
            FileStream fileStream = new FileStream("report.pdf", System.IO.FileMode.Create, System.IO.FileAccess.Write);
            fileStream.Write(decoded,0,decoded.Length);
            fileStream.Close();

            Console.WriteLine("Report got published successfully");
        }

    }
}
