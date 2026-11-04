Add-Type -AssemblyName System.Windows.Forms,System.Drawing
Add-Type @"
using System;using System.Runtime.InteropServices;
public static class VideoTestWindow {
[DllImport("user32.dll")] static extern int GetWindowLong(IntPtr h,int n);
[DllImport("user32.dll")] static extern int SetWindowLong(IntPtr h,int n,int value);
[DllImport("user32.dll")] static extern bool SetWindowPos(IntPtr h,IntPtr after,int x,int y,int w,int height,uint flags);
public static void Full(IntPtr h,int x,int y,int w,int height){SetWindowLong(h,-16,GetWindowLong(h,-16)&~0x00C40000);SetWindowPos(h,IntPtr.Zero,x,y,w,height,0x24);}
}
"@
$form=New-Object Windows.Forms.Form
$form.Text='灵犀视频流程验收';$form.Size=New-Object Drawing.Size(1000,700)
$player=New-Object Windows.Forms.GroupBox
$player.Text='验收视频播放器';$player.Location=New-Object Drawing.Point(50,80);$player.Size=New-Object Drawing.Size(800,450)
$progress=New-Object Windows.Forms.Label;$progress.Location=New-Object Drawing.Point(40,50);$progress.Size=New-Object Drawing.Size(250,40);$progress.Text='00:00 / 05:00'
$play=New-Object Windows.Forms.Button;$play.Text='播放';$play.Location=New-Object Drawing.Point(50,150);$play.Size=New-Object Drawing.Size(120,60)
$full=New-Object Windows.Forms.Button;$full.Text='全屏';$full.Location=New-Object Drawing.Point(220,150);$full.Size=New-Object Drawing.Size(120,60)
$web=New-Object Windows.Forms.Button;$web.Text='网页全屏';$web.Location=New-Object Drawing.Point(390,150);$web.Size=New-Object Drawing.Size(120,60)
$script:plays=0;$script:fulls=0;$script:webs=0;$watch=[Diagnostics.Stopwatch]::new()
function Report {[Console]::Out.WriteLine((@{windowHandle=$form.Handle.ToInt64();plays=$script:plays;fulls=$script:fulls;webs=$script:webs}|ConvertTo-Json -Compress));[Console]::Out.Flush()}
$play.Add_Click({$script:plays++;$watch.Start();$play.Text='暂停';Report})
$full.Add_Click({$script:fulls++;$screen=[Windows.Forms.Screen]::FromHandle($form.Handle).Bounds;[VideoTestWindow]::Full($form.Handle,$screen.X,$screen.Y,$screen.Width,$screen.Height);$player.Dock='Fill';$full.Text='退出全屏';Report})
$web.Add_Click({$script:webs++;Report})
$timer=New-Object Windows.Forms.Timer;$timer.Interval=200
$timer.Add_Tick({$progress.Text=('00:{0:00} / 05:00' -f [int][Math]::Floor($watch.Elapsed.TotalSeconds))})
$player.Controls.AddRange(@($progress,$play,$full,$web));$form.Controls.Add($player)
$form.Add_Shown({$timer.Start();Report});$form.Add_FormClosed({$timer.Stop();$timer.Dispose()})
[Windows.Forms.Application]::Run($form)
