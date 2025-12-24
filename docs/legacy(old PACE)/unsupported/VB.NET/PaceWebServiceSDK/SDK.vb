Module SDK

    Public HOST As String = "yourhost"
    Public PORT As Integer = 80
    Public USERNAME As String = "APIUserName"
    Public PASSWORD As String = "APIUserPassword"

    Sub Main()
        While True
            Dim choice As Integer = Prompt()
            If choice = 0 Then
                Console.WriteLine("Exiting...")
                Exit While
            End If
            Select Case choice
                Case 1
                    CreateJob.Run()
                    Exit Select
                Case 2
                    ReadCustomer.Run()
                    Exit Select
                Case 3
                    CloseJob.Run()
                    Exit Select
                Case 4
                    CloneJob.Run()
                    Exit Select
                Case 5
                    FindOpenJobs.Run()
                    Exit Select
                Case 6
                    FindObjects.Run()
                    Exit Select
                Case 7
                    FindObjectsAggregate.Run()
                    Exit Select
                Case 8
                    DeleteObject.Run()
                    Exit Select
                Case 9
                    ConvertToJob.Run()
                    Exit Select
                Case 10
                    InvokeProcessTest.Run()
                    Exit Select
                Case 11
                    ReadGLAccount.Run()
                    Exit Select
                Case 12
                    CreateJobTransactionUsingOverrideStatusAttribute.Run()
                    Exit Select
                Case 13
                    GeoLocateContacts.Run()
                    Exit Select
                Case 14
                    InvokePaceConnect.Run()
                    Exit Select
                Case 15
                    ListKeysForPaceConnectType.Run()
                    Exit Select
                Case 16
                    ListPaceConnectTypes.Run()
                    Exit Select
                Case 17
                    Scheduler.Run()
                    Exit Select
                Case 18
                    AttachmentService.Run()
                    Exit Select
                Case 19
                    GetVersion.Run()
                    Exit Select
                Case 20
                    ReceivePOLine.Run()
                    Exit Select
                Case 21
                    SystemInspector.Run()
                    Exit Select
                Case 22
                    FindObjectDateTimeConstraints.Run()
                    Exit Select
                Case 23
                    ReadJobShipment.Run()
                    Exit Select
                Case 24
                    ItemTemplateSample.Run()
                    Exit Select
                Case 25
                    JobPlanRefreshSample.Run()
                    Exit Select
                Case 26
                    CreateEstimate.Run()
                    Exit Select
                Case 27
                    CreateEstimatePart.Run()
                    Exit Select
                Case 28
                    ReportServiceSample.Run()
                    Exit Select    
                Case 29
                    ' Uncomment the below line for multi company.
                    ' Note : check the documentation for configurations before running this sample.
                    ' CreateJobSample.Run()
                    Exit Select
            End Select
        End While
    End Sub

    Function Prompt() As Integer
        Console.WriteLine("Example programs:")
        Console.WriteLine("1) Create Job")
        Console.WriteLine("2) Read Customer")
        Console.WriteLine("3) Close Job (update)")
        Console.WriteLine("4) Clone Job")
        Console.WriteLine("5) Find Open Jobs")
        Console.WriteLine("6) Find Objects")
        Console.WriteLine("7) Find-objects-aggregate")
        Console.WriteLine("8) Delete Cost Center")
        Console.WriteLine("9) Convert To Job - Invoke Action")
        Console.WriteLine("10) Invoke Process Test - GL Batch Trn Post")
        Console.WriteLine("11) Read GL Account")
        Console.WriteLine("12) Create-JobTransaction-Using-override status attribute")
        Console.WriteLine("13) Geo Locate Contacts")
        Console.WriteLine("14) Invoke Pace Connect")
        Console.WriteLine("15) ListKeys For PaceConnectType")
        Console.WriteLine("16) List Pace Connect Types")
        Console.WriteLine("17) Invoke Scheduler")
        Console.WriteLine("18) Attachment Service")
        Console.WriteLine("19) Get Version")
        Console.WriteLine("20) Receive PO Line")
        Console.WriteLine("21) System Inspector")
        Console.WriteLine("22) FindObjectDateTimeConstraints")
        Console.WriteLine("23) Read job shipment")
        Console.WriteLine("24) Run item template sample")
        Console.WriteLine("25) Refresh Job Plans")        
        Console.WriteLine("26) Create Estimate")
        Console.WriteLine("27) Create Estimate Part")
        Console.WriteLine("28) Execute Report Service Sample")
                        
        Console.WriteLine("29) Run multi company sample for creating job")
        Console.WriteLine("0) Exit")
        Console.Write("Which example would you like to run? ")
        While True
            Try
                Dim choice As Integer = Int32.Parse(Console.ReadLine())
                If (choice < 0) OrElse (choice > 29) Then
                    Continue While
                End If
                Return choice
            Catch
                Console.Write("Invalid choice. Please pick again: ")
            End Try
        End While
        Return -1
    End Function

End Module